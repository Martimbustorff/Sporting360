export interface IVideosRespose {
  pp: string
  cp: Cp
  season: Season
  matches: Match[]
}

export interface Cp {
  id: string
  id_st: string
  slug: string
  name: string
  emblem: string
}

export interface Season {
  id: string
  id_st: string
  name: string
}

export interface Match {
  id: string
  id_st: string
  dt: string
  hr: string
  n_vdos: string
  lst_vdo: any
  status: Status
  mday: Mday
  hteam: Hteam
  ateam: Ateam
}

export interface Status {
  id: string
  name: string
}

export interface Mday {
  id: string
  index: string
  name: string
}

export interface Hteam {
  id: string
  id_st: string
  abbrv: string
  name: string
  emblem: string
  home_kit: string
}

export interface Ateam {
  id: string
  id_st: string
  abbrv: string
  name: string
  emblem: string
}
