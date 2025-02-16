export default class Country {
    private _name: string
    private _a2code: string
    private _a3code: string
    private _continent: string
    private _region: string

    constructor(name: string, code: string, a3code: string, continent: string, region: string) {
        this._name = name
        this._a2code = code
        this._a3code = a3code
        this._continent = continent
        this._region = region
    }

    get name(): string {
        return this._name
    }

    get a2Code(): string {
        return this._a2code
    }

    get a3Code(): string {
        return this._a3code
    }

    get continent(): string {
        return this._continent
    }

    get region(): string {
        return this._region
    }
}