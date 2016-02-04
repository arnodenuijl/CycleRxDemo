import {Observable, Subject} from "rx";
import storageDriver from "@cycle/storage";
import {Person} from "./person";

export class AddPersonCommand {
    constructor(private firstName: string, private lastName: string) {
    }

    get FirstName() { return this.firstName; }
    get LastName() { return this.lastName; }
}

export class DeletePersonCommand {
    constructor(private id: number) {
    }

    get Id() { return this.id; }
}

export class ClearPersonsCommand {
}

export function personStoreDriver(commands$: Observable<any>) {
    let PERSONS_KEY = "persons";

    let proxy$ = new Subject<any>();
    let store = storageDriver(proxy$);

    let storageValue$: Observable<any> = store.local.getItem(PERSONS_KEY);
    let personsInStorage$: Observable<Person[]> = storageValue$
        .map(personsString => personsString || "[]")            // if initial is empty use an empty array (in the form of a json string)
        .map(personsString => JSON.parse(personsString))        // convert the json string to an array
        .shareReplay(1);

    let storageCommands = Observable.zip(personsInStorage$, commands$, (persons, command) => { // zip
        let nextId = persons.reduce((lastMax, person) => Math.max(person.id, lastMax), 0) + 1;
        if (command instanceof AddPersonCommand) {
          console.log("personStoreDriver - AddPerson: " + JSON.stringify(command));
          persons.push({ id: nextId, firstName: command.FirstName, lastName: command.LastName });
        }
        if (command instanceof DeletePersonCommand) {
          console.log("personStoreDriver - DeletePerson: " + JSON.stringify(command));
          persons = persons.filter(p => p.id !== command.Id);
        }
        if (command instanceof ClearPersonsCommand) {
          console.log("personStoreDriver - ClearPersons: " + JSON.stringify(command));
          persons = [];
        }
        return persons;
    }).subscribe(persons => proxy$.onNext({ key: PERSONS_KEY, value: JSON.stringify(persons) }));
    return personsInStorage$;
}
