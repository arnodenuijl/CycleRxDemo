import {run} from "@cycle/core";
import {makeDOMDriver, input, div, p, label, button, table, tr, td, th, thead, tbody } from "@cycle/dom";
import storageDriver from "@cycle/storage";
import {Observable} from "rx";
import {AddPersonCommand, DeletePersonCommand, ClearPersonsCommand} from "../personStoreDriver";
import {Person} from "../person";
import * as _ from "lodash";
/**
 *               DOM                          PersonStoreDriver
 * _______________________________          _____________________
 *       |         |         |                         |
 *       |         | personSelectionClick$         persons$
 *       |         |         |                       | |
 *       |         |         | _ _     _ _ _ _ _ _ _ | |
 *       V         |              |   |                |
 * clearClick$     |              V   V                |
 *       |         V       (combineLatest, scan)       |
 *       |   deleteClick$       selectedIds$           |
 *       |         |              |   |                |
 *       |         | (sample)     |   |                |
 *       |         |- - - - - - ->=   |_ _ _ _ _ _ _   |
*        |                        |                 |  |
 *       |                        V                 V  V
 *     (map)                    (map)          (combineLatest) 
 *  clearRequest$            deleteRequest$        vtree$
 *       |                        |                  |
 *       |                        |                  |
 *       V                        V                  V
 *     _____________________________        ________________
 *           PersonStoreDriver                     DOM
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
 * deleteRequest$        -> The deleteClick$ and selectedIds$ are combined to create a DeletePersonsCommand request for the latest ids in the selectedIds$ stream
 * clearClick$           -> Stream of clicks on the clear button
 * clearRequest$         -> The clearClick$ creates a ClearPersonsCommand request 
 **/
export function PersonList(drivers: { DOM: any, PersonStoreDriver: Observable<Person[]> }) {
    // Updates from the Person[]
    let persons$ = drivers.PersonStoreDriver.do(x => console.log("persons$: " + x.length + " persons")).shareReplay(1);

    // INTENT -- User events from the DOM
    let clearClick$: Observable<MouseEvent> = drivers.DOM.select(".clear").events("click").do(x => console.log("clearClick$"));  // Observe de clear click events
    let deleteClick$: Observable<MouseEvent> = drivers.DOM.select(".delete").events("click").do(x => console.log("deleteClick$:"));  // Observe de delete click events

    let personSelectionClick$: Observable<{ id: number, selected: boolean }> = drivers.DOM.select(".personrow").events("click")
        .map(ev => ev.currentTarget.dataset)
        .filter(data => data.id !== undefined)
        .map(data => ({ id: Number(data.id), selected: !(data.selected === "true") }))
        .share()
        // share because two streams use this. One for the vtree$ and one for the deleteRequest$. If not shared FIRST the vtree$ is altered
        // and rerendered and THEN the deleteRequest$ is processed. But that goes wrong because it operates on the already changed DOM
        .do(x => console.log("personSelectionClick$: " + JSON.stringify(x)));

    // MODEL
    let personIdSelected$ = personSelectionClick$.filter(click => click.selected).map(person => person.id).do(id => console.log("id selected: " + id)); // id of the selected person
    let personIdDeselected$ = personSelectionClick$.filter(click => !click.selected).map(person => person.id).do(id => console.log("id deselected: " + id)); // id of the deselected person
    let personIdsUpdated$ = persons$.map(personArray => personArray.map(person => person.id)); // array of ids for the latest list of persons 

    let initialSelectedIds: number[] = []; // initial selectedIds state
    // mutation functions
    let applyPersonSelected$ = personIdSelected$.map((id: number) => (selectedIds: number[]) => _.union(selectedIds, [id])); // function to add selected id to the selectedIds
    let applyPersonDeselected$ = personIdDeselected$.map((id: number) => (selectedIds: number[]) => _.without(selectedIds, id)); // function to remove deselected id from the selectedIds
    let applyPersonListUpdated$ = personIdsUpdated$.map((personIds: number[]) => (selectedIds: number[]) => _.intersection(selectedIds, personIds)); // remove selectedIds that are not in the personlist anymore

    // merge all the mutation functions and apply to the state starting with the initialSelectedIds
    let selectedIds$: Observable<number[]> = Observable.merge(applyPersonSelected$, applyPersonDeselected$, applyPersonListUpdated$)
        .scan((selectedIdsAccumulator: number[], applyFunction) => applyFunction(selectedIdsAccumulator), initialSelectedIds)
        .startWith(initialSelectedIds) // start with empty selection
        .do(x => console.log("selectedIds$: " + JSON.stringify(x)))
        .share();

    // if deleteClick$ is triggered sample the last selectedIds$ and delete them
    let deleteRequest$ = selectedIds$
        .sample(deleteClick$)
        .flatMap(ids => Observable.fromArray(ids))
        .map(id => new DeletePersonCommand(id))
        .do(req => console.log("deleteRequest$: " + JSON.stringify(req)));

    let clearRequest$ = clearClick$
        .map(_ => new ClearPersonsCommand())
        .do(req => console.log("clearRequest$: " + JSON.stringify(req)));


    let state$: Observable<State> = Observable.combineLatest(persons$, selectedIds$, (persons, selectedIds) => ({ persons, selectedIds }));

    // VIEW -- genereate virtual DOM
    let vtree$ = view(state$);

    return {
        DOM: vtree$,
        PersonStoreDriver: Observable.merge(deleteRequest$, clearRequest$)
    };
}

function view(state$: Observable<State>): Observable<any> {
    // Build up vtree from array of persons and idInput
    let vtree$ = state$.map(state =>
        div(".row", [
            table([
                thead([
                    tr([
                        th("Id"),
                        th("First Name"),
                        th("Last Name")
                    ])
                ]),
                tbody([
                    state.persons
                        .map(p => ({ person: p, selected: state.selectedIds.indexOf(p.id) >= 0 }))
                        .map(({person, selected}) =>
                            tr(".row.personrow", {
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
            div([button(".delete", "delete")]),
            div([button(".clear", "clear")])
            // selectedIds.length > 0 ? div([button(".delete", "delete")]) : null,
            // persons.length > 0 ? div([button(".clear", "clear")]) : null
        ])
    ).do(x => console.log("vtree$"));
    return vtree$;
}

interface State {
    persons: Person[];
    selectedIds: number[];
}
