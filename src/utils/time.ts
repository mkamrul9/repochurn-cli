export function getLookbackDateISO(daysAgo: number): string {
    // Hard cap to prevent massive historical data pulls that would stall the CLI
    if (daysAgo > 365) {
        throw new Error('Lookback window exceeds maximum limit. Please specify 365 days or fewer.');
    }

    const date = new Date();
    date.setUTCDate(date.getUTCDate() - daysAgo);
    return date.toISOString();
}