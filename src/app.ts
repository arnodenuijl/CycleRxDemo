import {run} from "@cycle/core";
import {makeDOMDriver, input, div, p, label, button, } from "@cycle/dom";
import {Observable} from "rx";
import {personStoreDriver, AddPerson, DeletePerson} from "./personStoreDriver";
import {PersonList} from "./components/personList";
import {EditPerson} from "./components/editPerson";
import {Person} from "./person";

function main(drivers: { DOM: any, PersonStoreDriver: Observable<Person[]> }) {
    // components
    let personList = PersonList(drivers);
    let editPerson = EditPerson(drivers);

    // Views
    enum ViewNames {
        ADD = 0,
        LIST = 1
    }

    let views = [];
    views[ViewNames.ADD] = editPerson;
    views[ViewNames.LIST] = personList;

    let selectedView$: Observable<any> = drivers.DOM.select(".select-view").events("click")
        .map(ev => <ViewNames>ev.target.dataset.view)
        .startWith(ViewNames.LIST)
        .map(uiAction => views[uiAction]);

    // create the dom from 
    let vtree$ = selectedView$.map(view => {
        return div([
            div([
                view.DOM
            ]),
            div([
                button(".select-view", { attributes: { "data-view": ViewNames.LIST } }, "Show list"),
                button(".select-view", { attributes: { "data-view": ViewNames.ADD } }, "Add Item")
            ])
        ]);
    });

    return {
        DOM: vtree$.do(x => console.log("vtree$")),
        PersonStoreDriver: Observable.merge(personList.PersonStoreDriver, editPerson.PersonStoreDriver).do(req => console.log("Req: " + JSON.stringify(req)))
    };

}

const drivers = {
    DOM: <any>makeDOMDriver("body"),
    PersonStoreDriver: personStoreDriver
};

run(main, drivers);
