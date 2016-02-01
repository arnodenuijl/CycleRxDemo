import {run} from "@cycle/core";
import {makeDOMDriver, input, div, p, label, button, } from "@cycle/dom";
import storageDriver from "@cycle/storage";
import {Observable} from "rx";
import {Person} from "../person";
import {AddPerson, DeletePerson} from "../personStoreDriver";

export function EditPerson(drivers: { DOM: any, PersonStoreDriver: Observable<Person[]>  }) {


    let dummyUsers: Person[] = [
        { id: 0, firstName: "Arno", lastName: "den Uijl" },
        { id: 1, firstName: "Ester", lastName: "van Lierop" },
        { id: 2, firstName: "Miguel", lastName: "Alvares" },
        { id: 3, firstName: "Mark", lastName: "Oosterbaan" }];

    let createClick$: Observable<MouseEvent> = drivers.DOM.select(".create-default").events("click");  // Observe de delete click events

    let storageRequests = createClick$.flatMap(_ => Observable.fromArray(dummyUsers))
                                       .map(x => new AddPerson(x.firstName, x.lastName));

    let vtree$ = Observable.just(0)
        .map(persons =>                                         // create the DOM from the array
            div([
                div([
                    button(".create-default", "create default")
                ]),
            ]));

    return {
        DOM: vtree$,
        PersonStoreDriver: storageRequests
    };
}
