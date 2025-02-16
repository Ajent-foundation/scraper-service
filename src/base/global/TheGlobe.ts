import Country from './Country'
import { COUNTRIES } from './constants/countries';

export default class TheGlobe {
    static countries : Country[] = COUNTRIES

    static getCountryByCode(code: string): Country | undefined {
        return this.countries.find(country => country.a2Code.toLowerCase() === code.toLowerCase())
    }

    static getCountryByA3Code(code: string): Country | undefined {
        return this.countries.find(country => country.a3Code.toLowerCase() === code.toLowerCase())
    }    
}