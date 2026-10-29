import { HttpErrorResponse } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { LinkItem, LinksService } from './links.service';

@Component({
  selector: 'app-root',
  imports: [],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  readonly links = signal<LinkItem[]>([]);
  readonly url = signal('');
  readonly createdLink = signal<LinkItem | null>(null);
  readonly error = signal<string | null>(null);
  readonly isLoading = signal(true);
  readonly isSubmitting = signal(false);

  constructor(private readonly linksService: LinksService) {
    this.loadLinks();
  }

  onUrlInput(event: Event): void {
    this.url.set((event.target as HTMLInputElement).value);
  }

  submitUrl(event: Event): void {
    event.preventDefault();
    const url = this.url().trim();
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(url);
    } catch {
      this.error.set('Enter a valid http or https URL.');
      return;
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      this.error.set('Enter a valid http or https URL.');
      return;
    }

    this.error.set(null);
    this.createdLink.set(null);
    this.isSubmitting.set(true);
    this.linksService.createLink(url).subscribe({
      next: (link) => {
        this.isSubmitting.set(false);
        this.createdLink.set(link);
        this.url.set('');
        this.loadLinks();
      },
      error: (error: unknown) => {
        this.isSubmitting.set(false);
        this.error.set(this.getErrorMessage(error));
      },
    });
  }

  private loadLinks(): void {
    this.isLoading.set(true);
    this.linksService.getLinks().subscribe({
      next: (links) => {
        this.links.set(links);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        this.isLoading.set(false);
        this.error.set(this.getErrorMessage(error));
      },
    });
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const apiError = error.error as { error?: unknown } | null;
      if (typeof apiError?.error === 'string') return apiError.error;
      if (error.status === 0) {
        return 'Could not reach the API at http://localhost:3000. Is the backend running?';
      }
    }

    return 'Something went wrong. Please try again.';
  }
}
