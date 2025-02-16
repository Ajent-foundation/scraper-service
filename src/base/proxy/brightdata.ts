import { Country } from "../global/index"

export type Network = 'residential' | 'datacenter' | 'isp' | 'isp-mexico'

export type ProxyConfig = {
  network: Network
  country: Country
  os?: 'windows' | 'osx' | 'android'
  sessionRotateIntervalHours?: number
  dnsResolutionLocation?: 'local' | 'remote'
  useNetworkCountry?: boolean
}

const ISPSupportedCountryCodes: string[] = [
  "US",
  "CA",
]

export function getProxyServerString() {
  return process.env.BRIGHTDATA_PROXY_HOST
}

// TODO - improve
export function getBrightDataAuth(userID: string, config: ProxyConfig): string {

  let countryCode = config.country.a2Code.toUpperCase()
  
  // Validation checks on networks
  // TODO - investigate why not supported
  if (config.network == 'isp' && !ISPSupportedCountryCodes.includes(countryCode)) {
    throw new Error("ISP IP not supported in requested country")
  }

  // What proxy credentials to use
  let username:string, password:string
  switch (config.network) {
    case 'residential':
      username = process.env.luminati_username
      password = process.env.luminati_password
      break
    case 'isp':
      username = process.env.luminati_username_isp_global
      password = process.env.luminati_password_isp_global
      break
    case 'isp-mexico':
      username = process.env.luminati_username_isp_mx
      password = process.env.luminati_password_isp_mx
      break
    case 'datacenter':
      username = process.env.luminati_username_dc
      password = process.env.luminati_password_dc 
      break
    default:
      throw new Error('Network must be one of: residential, isp, datacenter')
  }

  // If the flag is set to true, it means the country is inferred from the network 
  // The flag should be set true in cases when the zone is already targeting a specific country
  if (!config.useNetworkCountry) {
    username += '-country-' + countryCode
  }

  username += '-session-' + userID.substring(0, 16).replace(/[^0-9A-Za-z]/g, '')

  if (config.sessionRotateIntervalHours) {
    const appendTime = Date.now() / (60 * 60 * 1000 * config.sessionRotateIntervalHours)
    username += Math.floor(appendTime)
  }

  if (config.os) {
    username += '-os-' + config.os
  }

  if (config.dnsResolutionLocation) {
    username += '-dns-' + config.dnsResolutionLocation
  }

  return username + ':' + password
}