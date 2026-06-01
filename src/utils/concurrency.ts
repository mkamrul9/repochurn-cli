/**
 * Processes an array of items concurrently, but limits the maximum number of active promises.
 * This prevents network socket exhaustion and API abuse detection mechanisms.
 */
export async function processInBatches<T, R>(
    items: T[],
    batchSize: number,
    asyncFn: (item: T) => Promise<R>
): Promise<R[]> {
    const results: R[] = [];
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(asyncFn));
        results.push(...batchResults);
    }
    return results;
}