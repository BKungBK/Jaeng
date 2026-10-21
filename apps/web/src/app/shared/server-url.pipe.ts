import { Pipe, PipeTransform } from '@angular/core';
import { serverUrl } from '../core/server-config.service';

/** For image URLs the API hands over as `/sb/...`: in the APK they must point at the server. */
@Pipe({ name: 'serverUrl' })
export class ServerUrlPipe implements PipeTransform {
  transform(url: string): string {
    return serverUrl(url);
  }
}
