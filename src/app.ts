import {run} from "@cycle/core";
import {makeDOMDriver, div, button} from "@cycle/dom";
import {Observable} from "rx";
import {personStoreDriver} from "./personStoreDriver";
import {PersonList} from "./components/personList";
import {AddPerson} from "./components/addPerson";
import {Person} from "./Person";

require("!style!css!./css/normalize.css");
require("!style!css!./css/skeleton.css");

function main(drivers: { DOM: any, PersonStoreDriver: Observable<Person[]> }) {
    // Views
    enum ViewNames {
        ADD = 0,
        LIST = 1
    }

    let views = [];
    views[ViewNames.ADD] = AddPerson(drivers);
    views[ViewNames.LIST] = PersonList(drivers);

    let selectedView$: Observable<any> = drivers.DOM.select(".select-view").events("click")
        .map(ev => <ViewNames>ev.target.dataset.view)
        .startWith(ViewNames.LIST)
        .do(x => console.log("View: " + x))
        .map(uiAction => views[uiAction]);

    let personStoreRequests$ = selectedView$.flatMapLatest(view => view.PersonStoreDriver);

    // create the dom from
    let vtree$ = selectedView$.map(view => {
        return div(".container", [
            div(".row", [
                div([
                    button(".select-view", { attributes: { "data-view": ViewNames.LIST } }, "Show list"),
                    button(".select-view", { attributes: { "data-view": ViewNames.ADD } }, "Add Item")
                ]),
            ]),
            div(".row .maincontent", [
                view.DOM
            ])
        ]);
    });

    return {
        DOM: vtree$.do(x => console.log("vtree$")),
        PersonStoreDriver: personStoreRequests$
    };
}

const drivers = {
    DOM: <any>makeDOMDriver("#app"),
    PersonStoreDriver: personStoreDriver
};

run(main, drivers);
