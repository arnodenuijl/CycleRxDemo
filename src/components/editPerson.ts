import {run} from "@cycle/core";
import {makeDOMDriver, input, div, p, label, button, } from "@cycle/dom";
import storageDriver from "@cycle/storage";
import {Observable} from "rx";
import {Person} from "../person";
import {AddPerson, DeletePersons} from "../personStoreDriver";

export function EditPerson(drivers: { DOM: any, PersonStoreDriver: Observable<Person[]> }) {
    let personCountChanged$ = drivers.PersonStoreDriver.do(x => console.log("Person array updated " + x.length))
        .map(persons => persons.length)
        .distinctUntilChanged()
        .bufferWithCount(2, 1)
        .map(personLengths => personLengths[1] - personLengths[0])
        .share();

    let personCountChangedMessage$ = personCountChanged$.map(changedNum => changedNum > 0 ? div("Added " + changedNum + " persons") : div("Deleted " + changedNum + " persons"))
        .do(x => console.log("changed"));
    let clearMessage$ = personCountChangedMessage$.flatMap(_ => Observable.timer(2000)).map(x => "").do(x => console.log("cleared"));

    let message$ = Observable.merge(personCountChangedMessage$, clearMessage$).startWith("")

    let createClick$: Observable<MouseEvent> = drivers.DOM.select(".create-default").events("click");  // Observe de delete click events
    let firstNameInput$: Observable<any> = drivers.DOM.select(".firstName").events("input").map(ev => ev.target.value);  // Observe de delete click events
    let lastNameInput$: Observable<any> = drivers.DOM.select(".lastName").events("input").map(ev => ev.target.value);  // Observe de delete click events

    let storageRequest$ = Observable.combineLatest(firstNameInput$, lastNameInput$, (f, l) => ({firstName: f, lastName: l}))
                .sample(createClick$)
                .filter(x => x.firstName !== "" &&  x.lastName !== "")
                .map(x => new AddPerson(x.firstName, x.lastName));

    let vtree$ = message$.do(x => console.log("message changed"))
        .map(message =>                                         // create the DOM from the array
            div([
                div(".container", [
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
                    div([
                        button(".create-default", "Save")
                    ]),
                    div(message)
                ])
            ]));

    return {
        DOM: vtree$,
        PersonStoreDriver: storageRequest$
    };
}
