import {run} from "@cycle/core";
import {makeDOMDriver, input, div, p, label, button, } from "@cycle/dom";
import storageDriver from "@cycle/storage";
import {Observable} from "rx";
import {Person} from "../person";
import {AddPerson, DeletePersons} from "../personStoreDriver";

export function EditPerson(drivers: { DOM: any, PersonStoreDriver: Observable<Person[]>  }) {
  var personCountChanged$ = drivers.PersonStoreDriver.do(x => console.log("Person array updated " + x.length))
                      .map(persons => persons.length)
                      .distinctUntilChanged()
                      .bufferWithCount(2, 1)
                      .map(personLengths => personLengths[1] - personLengths[0])
                      .share();

  let changedMessage$ = personCountChanged$.map(changedNum => changedNum > 0 ?  div("Added " + changedNum + " persons") : div("Deleted " + changedNum + " persons"))
                                            .do(x => console.log("changed"));
  let clearMessage$ = changedMessage$.flatMap(_ => Observable.timer(2000)).map(x => "").do(x => console.log("cleared"));

  let message$ = Observable.merge(changedMessage$, clearMessage$).startWith("")

  let dummyUsers: Person[] = [
        { id: 0, firstName: "Arno", lastName: "den Uijl" },
      ];

    let createClick$: Observable<MouseEvent> = drivers.DOM.select(".create-default").events("click");  // Observe de delete click events

    let storageRequests = createClick$.flatMap(_ => Observable.fromArray(dummyUsers))
                                       .map(x => new AddPerson(x.firstName, x.lastName));

    let vtree$ = message$.do(x => console.log("message changed"))
        .map(message =>                                         // create the DOM from the array
            div([
                div([
                    button(".create-default", "create default")
                ]),
                message
            ]));

    return {
        DOM: vtree$,
        PersonStoreDriver: storageRequests
    };
}
