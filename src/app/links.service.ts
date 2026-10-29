import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface LinkItem {
  code: string;
  url: string;
  shortUrl: string;
  hits: number;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class LinksService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = 'http://localhost:3000/api/links';

  getLinks(): Observable<LinkItem[]> {
    return this.http.get<LinkItem[]>(this.endpoint);
  }

  createLink(url: string): Observable<LinkItem> {
    return this.http.post<LinkItem>(this.endpoint, { url });
  }
}