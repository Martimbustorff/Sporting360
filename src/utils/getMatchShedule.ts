import axios from "axios";
import ical from "ical.js";
import { MatchSchedule } from "../interfaces/MatchSchedule";
const daysOfWeekPt = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

function formatDateToCustomString(inputDate) {
  const dateParts = inputDate.split('-');
  const year = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10);
  const day = parseInt(dateParts[2], 10);

  const date = new Date(year, month - 1, day); // Months are zero-indexed

  const dayOfWeek = daysOfWeekPt[date.getDay()];
  const dayOfMonth = date.getDate();

  return `${dayOfWeek} ${dayOfMonth}`;
}


export const handleGetCalendarIcal = async ():Promise<MatchSchedule> => {
  let newItems:MatchSchedule = {}
  const response = await axios.get('https://ics.fixtur.es/v2/sporting-portugal.ics');
  const data = response.data;
  const jcalData = ical.parse(data);
  const comp = new ical.Component(jcalData);
  comp.getAllSubcomponents('vevent').forEach((vevent) => {
    const event = new ical.Event(vevent);
    const dateStr = String(event.startDate.toJSDate().toISOString().split('T')[0]);
    const yyMM = dateStr.substring(0,7)
    if(Number(yyMM.split('-')[0]) > 2023 || (Number(yyMM.split('-')[0]) >= 2023 && (Number(yyMM.split('-')[1]) >= 8))){
      if (!newItems[yyMM]) {
        newItems[yyMM] = [];
      }
      const scorePattern = /\((\d+-\d+)\)/; // Regular expression to match the score pattern
      const match = event.summary.match(scorePattern);
      const gameEvent = event.summary.replace(scorePattern, '')
      if (event.startDate.hour !== 0 && event.startDate.minute !== 0) { // don't show all day events time
        newItems[yyMM].push({
          name: event.summary,
          homeTeam:gameEvent.split("-")[0],
          awaiTeam:gameEvent.split("-")[1],
          result: match ? match[1] : "",
          data:formatDateToCustomString(dateStr),
          time: (Number(Number(event.startDate.hour) + 1)) + ':' + event.startDate.minute,
        });
      } else {
        newItems[yyMM].push({
          name: event.summary,
          data:formatDateToCustomString(dateStr),
          homeTeam:gameEvent.split("-")[0],
          awaiTeam:gameEvent.split("-")[1],
          result: match ? match[1] : "",
          time: 'N/D',
        });
      }
    }
  })
  return newItems
}