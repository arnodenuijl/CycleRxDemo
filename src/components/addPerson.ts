import {run} from "@cycle/core";
import {makeDOMDriver, input, div, p, label, button, span} from "@cycle/dom";
import storageDriver from "@cycle/storage";
import {Observable} from "rx";
import {Person} from "../person";
import {AddPersonCommand} from "../personStoreDriver";

/**
 *            DOM                               PersonStoreDriver
 *   ______________________________           _____________________
 *       |             |         |                     |
 * firstNameInput$     |         |                  persons$
 *       |             |         |                     |
 *       |     lastNameInput$    |                     |
 *       |             |         |                     V
 *       |             |   createClick$        personCountChanged$
 *       |             |         |                     |
 *       |             |         |                     |
 *       |             |         |                     V
 *       |_ _ _ _    _ |         |        personCountChangedMessage$
 *              |   |            |                |           |
 *              V___V            |                |           |
 *               |               |                |           |
 *               | <-------------|                |           V
 *               |                                |      clearMessage$
 *               |                                |           |
 *               |                                |_ _ _ _ _ _|
 *               |                                      |           
 *               |                                      V           
 *          addRequest$                              vtree$
 *                |                                     |
 *                |                                     |
 *                V                                     V
 *       ____________________                    ________________
 *        PersonStoreDriver                            DOM
 *
 *
 * DOM                   -> DOM driver
 *                               -> Source: Virtual DOM from which we can listen to events from the user
 *                               -> Sink:   Takes an Observable of generated Virtual DOMs
 * PersonStoreDriver     -> Local storage driver for persons
 *                               -> Source: Observable that gives a list of Persons everytime the list in the storage is updated
 *                               -> Sink:   Takes an Observable of actions on the persons in storage to add and delete persons (AddPerson, DeletePersons)
 *
 * persons$                    -> Stream of Person[]. Everytime the list of persons changes a new array is pushed
 * personCountChanged$         -> Listens to the persons$ stream and emits a number indicating how many persons are added or deleted
 * personCountChangedMessage$  -> Formats a  message for the user about the change of person count
 * clearMessage$               -> Times an empty message after each personCountChangedMessage$ to clear the message
 * vtree$                      -> The virtual dom is created from the person$ (for the data) and the selectedIds$ (for the highlights)
 * firstNameInput$             -> Stream of the inputed first name
 * lastNameInput$              -> Stream of the inputed last name
 * createClick$                -> When the user clicks save
 * addRequest$                 -> Whem the user clicks save and the first and last names are not empty a request is made to persist the person
 **/

export function AddPerson(drivers: { DOM: any, PersonStoreDriver: Observable<Person[]> }) {
        // Updates from the Person[]
    let persons$ = drivers.PersonStoreDriver.do(x => console.log("persons$: " + x.length + " persons")).shareReplay(1);

    let personCountChanged$ = persons$
        .map(persons => persons.length)
        .distinctUntilChanged()
        .bufferWithCount(2, 1)
        .map(personLengths => personLengths[1] - personLengths[0])
        .do(x => console.log("personCountChanged$: diff: " + x))
        .share();

    // notification if the person changed count is changed
    let personCountChangedMessage$ = personCountChanged$.map(changedNum => changedNum > 0 ? "Added " + changedNum + " persons" : "Deleted " + changedNum + " persons")
        .do(x => console.log("personCountChangedMessage$: " + x));
    let clearMessage$ = personCountChangedMessage$.flatMap(_ => Observable.timer(2000)).map(x => "").do(x => console.log("clearMessage$"));
    let message$ = Observable.merge(personCountChangedMessage$, clearMessage$).startWith("").do(x => console.log("message$: '" + x + "'"));

    let createClick$: Observable<MouseEvent> = drivers.DOM.select(".create-default").events("click").do(x => console.log("createClick$"));  // Observe de delete click events

    // save person
    let firstNameInput$: Observable<any> = drivers.DOM.select(".firstName").events("input").map(ev => ev.target.value).do(x => console.log("firstNameInput$: " + x));
    let lastNameInput$: Observable<any> = drivers.DOM.select(".lastName").events("input").map(ev => ev.target.value).do(x => console.log("lastNameInput$: " + x));

    let addRequest$ = Observable.combineLatest(firstNameInput$, lastNameInput$, (f, l) => ({ firstName: f, lastName: l }))
        .sample(createClick$)
        .filter(x => x.firstName !== "" && x.lastName !== "")
        .map(x => new AddPersonCommand(x.firstName, x.lastName))
        .do(x => console.log("addRequest$: " + JSON.stringify(x)));

    let vtree$ = message$
        .map(message =>
            div([
                div(".row", [
                    div(".two .columns", [
                        label(".label", "First name"),
                    ]),
                    div(".three .columns", [
                        input(".firstName")
                    ])
                ]),
                div(".row", [
                    div(".two .columns", [
                        label(".label", "Last name"),
                    ]),
                    div(".three .columns", [
                        input(".lastName")
                    ])
                ]),
                div(".row", [
                    div(".two .columns", [
                        button(".create-default", "Save"),
                        span(message)
                    ])
                ])
            ])).do(x => console.log("vtree$"));
    return {
        DOM: vtree$,
        PersonStoreDriver: addRequest$
    };
}
