import {run} from "@cycle/core";
import {makeDOMDriver, input, div, p, label, button, table, tr, td } from "@cycle/dom";
import storageDriver from "@cycle/storage";
import {Observable} from "rx";
import {AddPerson, DeletePersons} from "../personStoreDriver";
import {Person} from "../person";
import {toggle} from "../toggle";
import * as _ from "lodash";

export function PersonList(drivers: { DOM: any, PersonStoreDriver: Observable<Person[]> }) {
    let PERSONS_KEY = "persons";
    let persons$ = drivers.PersonStoreDriver.do(x => console.log("Persons: " + JSON.stringify(x)));

    let selectionToggled$: Observable<{ id: number, selected: boolean }> = drivers.DOM.select(".row").events("click")
        .map(ev => ev.currentTarget.dataset)
        .map(data => ({ id: Number(data.id), selected: !(data.selected === "true") }))
        .share() // share because two streams use this. One for the vtree$ and one for the deleteRequest$. If not shared FIRST the vtree$ is altered 
                 // and rerendered and THEN the deleteRequest$ is processed. But that goes wrong because it operates on the already changed DOM
        .do(x => console.log("selectionToggled$: " + JSON.stringify(x)));

    let selectedIds$ = Observable.combineLatest(persons$, selectionToggled$, (persons, selectionToggled) => ({ persons, selectionToggled }))
        .scan((selectedIds: number[], value: ({ persons: Person[], selectionToggled: ({ id: number, selected: boolean }) })) =>
            determineSelectedIds(selectedIds, value.persons, value.selectionToggled),
        [])                    // and filter out already deleted ids
        .startWith([])
        .do(x => console.log("Selected ids: " + JSON.stringify(x)));

    let deleteClick$: Observable<MouseEvent> = drivers.DOM.select(".delete").events("click");  // Observe de delete click events
    let deleteRequest$ = selectedIds$.do(x => console.log("prepare for delete: " + JSON.stringify(x)))
        .sample(deleteClick$)
        .filter(ids => ids.length > 0)
        .map(ids => new DeletePersons(ids));

    // Build up vtree from array of persons and idInput
    let vtree$ = Observable.combineLatest(persons$, selectedIds$, (persons, selectedIds) => {
        return div([
            table([
                tr([
                    td("Id"),
                    td("First Name"),
                    td("Last Name")
                ]),
                persons
                    .map(p => ({ person: p, selected: selectedIds.indexOf(p.id) >= 0 }))
                    .map(({person, selected}) =>
                        tr(".row", {
                            attributes: {
                                "data-id": person.id,
                                "data-selected": selected
                            },
                            style: { "background-color": selected ? "#00b369" : "#ffffff" }
                        }, [
                                td("", person.id),
                                td("", person.firstName),
                                td("", person.lastName)
                            ])),
            ]),
            selectedIds.length > 0 ? div([button(".delete", "delete")]) : null
        ]);
    });

    return {
        DOM: vtree$.do(x => console.log("vtree$ personlist")),
        PersonStoreDriver: <Observable<any>>deleteRequest$
    };
}

function determineSelectedIds(currentSelectedIds: number[], latestPersonList: Person[], latestSelectionToggled: ({ id: number, selected: boolean })) {
    let personIds = latestPersonList.map(x => x.id);

    let selectedIds = currentSelectedIds;
    if (latestSelectionToggled.selected) {
        selectedIds = _.union(selectedIds, [latestSelectionToggled.id]);     // include selected
    } else {
        selectedIds = _.without(selectedIds, latestSelectionToggled.id);     // remove deselected
    }
    selectedIds = _.intersection(personIds, selectedIds);                    // only keep ids that are in the person list
    return selectedIds;
}