import { startOfWeek, differenceInWeeks } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

// Set the application-wide timezone
const timeZone = 'America/New_York';

// Set the official start date of the first contest week.
// IMPORTANT: This date should be a Sunday in New York Time.
const CONTEST_START_DATE = fromZonedTime('2024-01-07T00:00:00', timeZone);

/**
 * Calculates the current contest week number based on New York Time.
 * Week 1 is the week of the CONTEST_START_DATE.
 * @returns The current week number.
 */
export function getCurrentWeekNumber(): number {
  const now = new Date(); // Current time in UTC
  const nowInNY = toZonedTime(now, timeZone);
  const startOfThisWeekInNY = startOfWeek(nowInNY, { weekStartsOn: 0 }); // 0 = Sunday

  const weeksSinceStart = differenceInWeeks(startOfThisWeekInNY, CONTEST_START_DATE, { roundingMethod: 'floor' });
  return weeksSinceStart + 1;
}

/**
 * Checks if the submission period for the current week is over.
 * The deadline is Saturday at 23:59:59 New York Time.
 * @returns True if the deadline has passed, false otherwise.
 */
export function isSubmissionPeriodOver(): boolean {
    const now = new Date();
    const nowInNY = toZonedTime(now, timeZone);
    const dayOfWeekInNY = nowInNY.getDay(); // Sunday = 0, Saturday = 6
    
    // The submission period is over on Saturday after 23:59:59 NY Time, 
    // which is effectively Sunday morning in New York.
    return dayOfWeekInNY === 0;
}

/**
 * Checks if the voting period for a specific week number is over.
 * The voting period for a week ends on the Sunday 00:00:00 UTC that begins the *next* week.
 * @param weekNumber The contest week to check.
 * @returns True if the voting period for that week is over, false otherwise.
 */
export function isVotingPeriodOverForWeek(weekNumber: number): boolean {
    const now = new Date();
    const currentWeekNumber = getCurrentWeekNumber();
    
    // If the week being checked is a future week, voting is not open yet.
    if (weekNumber > currentWeekNumber) {
        return true; 
    }

    // If the week being checked is a past week, the voting is definitely over.
    if (weekNumber < currentWeekNumber) {
        return true;
    }

    // If it's the current week, the voting period is over if the submission period is over (i.e., it's Sunday).
    return isSubmissionPeriodOver();
} 