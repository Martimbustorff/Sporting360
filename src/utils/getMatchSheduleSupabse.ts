import axios from "axios";
import ical from "ical.js";
import { MatchSchedule } from "../interfaces/MatchSchedule";
const daysOfWeekPt = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];


export const handleGetCalendarSupabase = async ():Promise<MatchSchedule> => {
  let newItems:MatchSchedule = {}
 
  return newItems
}