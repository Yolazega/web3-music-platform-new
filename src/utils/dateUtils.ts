// Placeholder date utility functions
// We'll need to define the logic for these based on the platform's rules for voting weeks and sharing periods.

export interface VotingWeekInfo {
    startDate: Date;
    endDate: Date;
    weekId: string; // e.g., YYYY-WW or a unique ID derived from start date
}

export const VOTING_WEEK_DURATION_DAYS = 7;
export const VOTING_WEEK_START_DAY_OF_WEEK = 1; // 0 for Sunday, 1 for Monday, etc.

/**
 * Calculates the voting week information (startDate, endDate, weekId) for a given date.
 * @param date The date for which to determine the voting week.
 */
export const getCurrentVotingWeek = (date: Date = new Date()): VotingWeekInfo => {
    const currentDay = date.getDay(); // Sunday: 0, Monday: 1, ..., Saturday: 6
    const daysToSubtract = (currentDay - VOTING_WEEK_START_DAY_OF_WEEK + 7) % 7;
    
    const startDate = new Date(date);
    startDate.setDate(date.getDate() - daysToSubtract);
    startDate.setHours(0, 0, 0, 0); // Start of the day

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + VOTING_WEEK_DURATION_DAYS - 1);
    endDate.setHours(23, 59, 59, 999); // End of the day

    // Generate a weekId, e.g., based on the start date YYYY-MM-DD
    const year = startDate.getFullYear();
    const month = (startDate.getMonth() + 1).toString().padStart(2, '0');
    const day = startDate.getDate().toString().padStart(2, '0');
    const weekId = `VW-${year}-${month}-${day}`;

    return {
        startDate,
        endDate,
        weekId,
    };
};

/**
 * Checks if voting for the week corresponding to the given date is currently active.
 * @param date The date to check against.
 */
export const isVotingActive = (date: Date = new Date()): boolean => {
    const now = new Date();
    const { startDate, endDate } = getCurrentVotingWeek(date);
    // Example: Voting is active if 'now' is within the startDate and endDate of the week for 'date'.
    // This might need to align with how the smart contract defines active voting weeks.
    return now >= startDate && now <= endDate;
};

/**
 * Checks if the sharing period for the week corresponding to the given date is active.
 * Placeholder: Assumes sharing is active for 7 days *after* the voting week ends.
 * @param date The date for which the original voting week occurred.
 */
export const isWithinSharingWindow = (dateForVotingWeek: Date = new Date()): boolean => {
    const now = new Date();
    const votingWeekInfo = getCurrentVotingWeek(dateForVotingWeek);
    
    const sharingWindowStartDate = new Date(votingWeekInfo.endDate);
    sharingWindowStartDate.setDate(votingWeekInfo.endDate.getDate() + 1); // Starts day after voting ends
    sharingWindowStartDate.setHours(0,0,0,0);

    const sharingWindowEndDate = new Date(sharingWindowStartDate);
    sharingWindowEndDate.setDate(sharingWindowStartDate.getDate() + VOTING_WEEK_DURATION_DAYS -1 ); // Lasts 7 days
    sharingWindowEndDate.setHours(23,59,59,999);

    return now >= sharingWindowStartDate && now <= sharingWindowEndDate;
};

/**
 * Formats a date object, timestamp, or string into a readable string.
 * @param date The date to format.
 * @param formatString Optional format string (e.g., 'YYYY-MM-DD HH:mm:ss').
 */
export const formatDate = (date: Date | string | number, formatString?: string): string => {
    const d = new Date(date);
    if (formatString) {
        let formatted = formatString;
        formatted = formatted.replace('YYYY', d.getFullYear().toString());
        formatted = formatted.replace('MM', (d.getMonth() + 1).toString().padStart(2, '0'));
        formatted = formatted.replace('DD', d.getDate().toString().padStart(2, '0'));
        formatted = formatted.replace('HH', d.getHours().toString().padStart(2, '0'));
        formatted = formatted.replace('mm', d.getMinutes().toString().padStart(2, '0'));
        formatted = formatted.replace('ss', d.getSeconds().toString().padStart(2, '0'));
        return formatted;
    }
    // Default to a more common format like YYYY-MM-DD
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// We might need more sophisticated logic for week calculations, considering timezones,
// specific start times for voting (e.g., Monday 00:00 UTC), etc. 