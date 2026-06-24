/**
 * Lightweight ASCII spinner — zero extra dependencies.
 *
 * Usage:
 *   const spinner = new Spinner('Loading commits');
 *   spinner.start();
 *   // ... await work ...
 *   spinner.succeed('Done!');
 */
export class Spinner {
    private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    private frameIndex = 0;
    private intervalId: ReturnType<typeof setInterval> | null = null;
    private label: string;
    private enabled: boolean;

    constructor(label: string, enabled = true) {
        this.label = label;
        this.enabled = enabled;
    }

    /** Update the spinner label without stopping it */
    setLabel(label: string): void {
        this.label = label;
    }

    start(): void {
        if (!this.enabled || !process.stdout.isTTY) return;
        this.intervalId = setInterval(() => {
            const frame = this.frames[this.frameIndex % this.frames.length];
            process.stdout.write(`\r\x1b[36m${frame}\x1b[0m ${this.label}  `);
            this.frameIndex++;
        }, 80);
    }

    private stop(symbol: string, message: string): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        if (process.stdout.isTTY) {
            process.stdout.write(`\r${symbol} ${message}\n`);
        }
    }

    succeed(message?: string): void {
        this.stop('\x1b[32m✔\x1b[0m', message ?? this.label);
    }

    fail(message?: string): void {
        this.stop('\x1b[31m✖\x1b[0m', message ?? this.label);
    }

    info(message?: string): void {
        this.stop('\x1b[34mℹ\x1b[0m', message ?? this.label);
    }
}
