export interface IVideosGamesResponse {
  pp: number
  match: Match
  n_vdos: number
  vdos: Vdo[]
}

export interface Match {
  id: string
  dt: string
  hr: string
  htgoal: string
  atgoal: string
  venue: Venue
  season: Season
  cp: Cp
  mday: Mday
  hteam: Hteam
  ateam: Ateam
  name: string
}

export interface Venue {
  id: string
  id_st: any
  name: string
  city: string
  address: string
  weather_local_id: string
}

export interface Season {
  id: string
  name: string
}

export interface Cp {
  id: string
  slug: string
  name: string
}

export interface Mday {
  id: string
  name: string
}

export interface Hteam {
  id: string
  name: string
}

export interface Ateam {
  id: string
  name: string
}

export interface Vdo {
  id: string
  dt: string
  type: string
  minute: string
  title: string
  bigpic: string
  vdo: string
  social: any[]
  res?: string
  links: link
}

export interface link{
  video: string
  embed: string
}