import {Observable, Subject} from "rx";
import storageDriver from "@cycle/storage";
import {Person} from "./person";

export class AddPerson {
    constructor(private firstName: string, private lastName: string) {
    }

    get FirstName() { return this.firstName; }
    get LastName() { return this.lastName; }
}

export class DeletePersons {
    constructor(private ids: number[]) {
    }

    get Ids() { return this.ids; }
}

export function personStoreDriver(commands$: Observable<any>) {
    let PERSONS_KEY = "persons";

    let proxy$ = new Subject<any>();
    let store = storageDriver(proxy$);

    let storageValue$: Observable<any> = store.local.getItem(PERSONS_KEY);
    let personsInStorage$: Observable<Person[]> = storageValue$
        .map(personsString => personsString || "[]")            // if initial is empty use an empty array (in the form of a json string)
        .map(personsString => JSON.parse(personsString))        // convert the json string to an array
        .do(x => console.log("personsInStorage$: " + x))
        .shareReplay(1);

    commands$ = commands$.do(x => console.log("commands$: " + x)); // log the commands

    let storageCommands = Observable.zip(personsInStorage$, commands$, (persons, command) => { // zip
        console.log("Ting!!!!");
        let nextId = persons.reduce((lastMax, person) => Math.max(person.id, lastMax), 0) + 1;
        if (command instanceof AddPerson) {
            persons.push({ id: nextId, firstName: command.FirstName, lastName: command.LastName });
        }
        if (command instanceof DeletePersons) {
            persons = persons.filter(p => command.Ids.indexOf(p.id) < 0);
        }
        return persons;
    }).subscribe(persons => proxy$.onNext({ key: PERSONS_KEY, value: JSON.stringify(persons) }));
    return personsInStorage$;
}
