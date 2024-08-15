///
/// Copyright © 2016-2024 The Thingsboard Authors
///
/// Licensed under the Apache License, Version 2.0 (the "License");
/// you may not use this file except in compliance with the License.
/// You may obtain a copy of the License at
///
///     http://www.apache.org/licenses/LICENSE-2.0
///
/// Unless required by applicable law or agreed to in writing, software
/// distributed under the License is distributed on an "AS IS" BASIS,
/// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
/// See the License for the specific language governing permissions and
/// limitations under the License.
///

import { Injectable } from '@angular/core';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpParams,
  HttpRequest,
  HttpStatusCode
} from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { MatDialog } from '@angular/material/dialog';
import {
  EntityConflictDialogComponent
} from '@shared/components/dialog/entity-conflict-dialog/entity-conflict-dialog.component';
import { HasId } from '@shared/models/base-data';
import { HasVersion } from '@shared/models/entity.models';
import { getInterceptorConfig } from './interceptor.util';
import { isDefined } from '@core/utils';
import { InterceptorConfig } from '@core/interceptors/interceptor-config';

@Injectable()
export class EntityConflictInterceptor implements HttpInterceptor {

  constructor(
    private dialog: MatDialog,
  ) {}

  intercept(request: HttpRequest<unknown & HasId & HasVersion>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (!request.url.startsWith('/api/')) {
      return next.handle(request);
    }

    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status !== HttpStatusCode.Conflict) {
          return throwError(() => error);
        }

        return this.handleConflictError(request, next, error);
      })
    );
  }

  private handleConflictError(
    request: HttpRequest<unknown & HasId & HasVersion>,
    next: HttpHandler,
    error: HttpErrorResponse
  ): Observable<HttpEvent<unknown>> {
    if (getInterceptorConfig(request).ignoreVersionConflict) {
      return throwError(() => error);
    }

    return this.openConflictDialog(request.body, error.error.message).pipe(
      switchMap(result => {
        if (isDefined(result)) {
          if (result) {
            return next.handle(this.updateRequestVersion(request));
          }
          (request.params as HttpParams & { interceptorConfig: InterceptorConfig }).interceptorConfig.ignoreErrors = true;
          return next.handle(request);
        }
        return of(null);
      })
    );
  }

  private updateRequestVersion(request: HttpRequest<unknown & HasId & HasVersion>): HttpRequest<unknown & HasId & HasVersion> {
    const body = { ...request.body, version: null };
    return request.clone({ body });
  }

  private openConflictDialog(entity: unknown & HasId & HasVersion, message: string): Observable<boolean> {
    const dialogRef = this.dialog.open(EntityConflictDialogComponent, {
      disableClose: true,
      data: { message, entity },
      panelClass: ['tb-dialog', 'tb-fullscreen-dialog'],
    });

    return dialogRef.afterClosed();
  }
}
