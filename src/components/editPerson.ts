import {run} from "@cycle/core";
import {makeDOMDriver, input, div, p, label, button, span} from "@cycle/dom";
import storageDriver from "@cycle/storage";
import {Observable} from "rx";
import {Person} from "../person";
import {AddPerson} from "../personStoreDriver";

export function EditPerson(drivers: { DOM: any, PersonStoreDriver: Observable<Person[]> }) {
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

    let storageRequest$ = Observable.combineLatest(firstNameInput$, lastNameInput$, (f, l) => ({ firstName: f, lastName: l }))
        // .replay(null, 1)
        .sample(createClick$)
        .filter(x => x.firstName !== "" && x.lastName !== "")
        .map(x => new AddPerson(x.firstName, x.lastName))
        .do(x => console.log("storageRequest$: " + JSON.stringify(x)));

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
        PersonStoreDriver: storageRequest$
    };
}
