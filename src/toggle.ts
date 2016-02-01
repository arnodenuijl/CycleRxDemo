
export function toggle<T>(array: Array<T>, value: T): Array<T> {
    let copy = array.slice(0);
    let index = array.indexOf(value);
    index >= 0 ? copy.splice(index, 1) : copy.push(value);
    return copy;
}