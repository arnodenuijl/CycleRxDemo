import {run} from "@cycle/core";
import {makeDOMDriver, input, div, p, label, button, table, tr, td, th, thead, tbody } from "@cycle/dom";
import storageDriver from "@cycle/storage";
import {Observable} from "rx";
import {AddPerson, DeletePersons} from "../personStoreDriver";
import {Person} from "../person";
import {toggle} from "../toggle";
import * as _ from "lodash";
/**
 *            DOM                     PersonStoreDriver
 *      ______________             _____________________
 *       |         |                         |
 *       | personSelectionClick$         persons$
 *       |         |                       | |
 *       |         | _ _     _ _ _ _ _ _ _ | |
 *       |              |   |                |
 *       |              V   V                |
 *       V           selectedIds$            |
 *  deleteClick$        |   |                |
 *       |              |   |                |
 *       |              |   |                |
 *       |_ _ _ _    _ _|   |_ _ _ _ _ _ _   |
 *              |   |                     |  |
 *              V   V                     V  V
 *          deleteRequest$               vtree$
 *                |                        |
 *                |                        |
 *                V                        V
 *       ____________________        ________________
 *        PersonStoreDriver                DOM
 *
 *
 * DOM                   -> DOM driver
 *                               -> Source: Virtual DOM from which we can listen to events from the user
 *                               -> Sink:   Takes an Observable of generated Virtual DOMs
 * PersonStoreDriver     -> Local storage driver for persons
 *                               -> Source: Observable that gives a list of Persons everytime the list in the storage is updated
 *                               -> Sink:   Takes an Observable of actions on the persons in storage to add and delete persons (AddPerson, DeletePersons)
 *
 * persons$              -> Stream of Person[]. Everytime the list of persons changes a new array is pushed
 * personSelectionClick$ -> If a person id selected or deselected this stream gives the Id of the person and if it is selected or deselected
 * selectedIds$          -> The person$ and personSelectionClick$ streams are combined to determine what the current selected ids are. This stream emits an array of selected ids
 * vtree$                -> The virtual dom is created from the person$ (for the data) and the selectedIds$ (for the highlights)
 * deleteClick$          -> Stream of clicks on the delete button
 * deleteRequest$        -> The deleteClick$ and selectedIds$ are combined to create a DeletePersons request for the latest ids in the selectedIds$ stream
 **/
export function PersonList(drivers: { DOM: any, PersonStoreDriver: Observable<Person[]> }) {
    // Updates from the Person[]
    let persons$ = drivers.PersonStoreDriver.do(x => console.log("Persons: " + JSON.stringify(x)));

    // INTENT -- User events from the DOM
    let deleteClick$: Observable<MouseEvent> = drivers.DOM.select(".delete").events("click");  // Observe de delete click events
    let personSelectionClick$: Observable<{ id: number, selected: boolean }> = drivers.DOM.select(".row").events("click")
        .map(ev => ev.currentTarget.dataset)
        .map(data => ({ id: Number(data.id), selected: !(data.selected === "true") }))
        .share()
        // share because two streams use this. One for the vtree$ and one for the deleteRequest$. If not shared FIRST the vtree$ is altered
        // and rerendered and THEN the deleteRequest$ is processed. But that goes wrong because it operates on the already changed DOM
        .do(x => console.log("selectionToggled$: " + JSON.stringify(x)));

    // MODEL
    // combine persons$ and personSelectionClick$ to determine the currently selected ids
    let PersonsAndClicksCombined$: Observable<PersonsAndClicksCombined> = Observable.combineLatest(persons$, personSelectionClick$, (persons, personSelectionClick) => ({ persons, personSelectionClick }));
    let selectedIds$: Observable<number[]> = PersonsAndClicksCombined$
        .scan((selectedIdsAccumulator: number[], value: PersonsAndClicksCombined) =>
            determineSelectedIds(selectedIdsAccumulator, value.persons, value.personSelectionClick),
        [])
        .startWith([]) // start with empty selection
        .do(x => console.log("Selected ids: " + JSON.stringify(x)));

    // if deleteClick$ is triggered sample the last selectedIds$ and delete them
    let deleteRequest$ = selectedIds$.do(x => console.log("prepare for delete: " + JSON.stringify(x)))
        .sample(deleteClick$)
        .filter(ids => ids.length > 0)
        .map(ids => new DeletePersons(ids));

    // VIEW -- genereate virtual DOM
    let vtree$ = view(persons$, selectedIds$);

    return {
        DOM: vtree$.do(x => console.log("vtree$ personlist")),
        PersonStoreDriver: <Observable<any>>deleteRequest$
    };
}

function view(persons$: Observable<Person[]>, selectedIds$: Observable<number[]>): Observable<any> {
    // Build up vtree from array of persons and idInput
    let vtree$ = Observable.combineLatest(persons$, selectedIds$, (persons, selectedIds) =>
        div([
            table([
                thead([
                    tr([
                        th("Id"),
                        th("First Name"),
                        th("Last Name")
                    ])
                ]),
                tbody([
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
                ])
            ]),
            selectedIds.length > 0 ? div([button(".delete", "delete")]) : null
        ])
    );
    return vtree$;
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

interface PersonsAndClicksCombined {
    persons: Person[];
    personSelectionClick: ({ id: number, selected: boolean });
}
