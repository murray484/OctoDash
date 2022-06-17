import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy } from '@angular/core';
import { Subscription, timer } from 'rxjs';

import { ConfigService } from '../config/config.service';
import { FilamentSpool, NotificationType, PrinterState, PrinterStatus, TemperatureReading } from '../model';
import { NotificationService } from '../notification/notification.service';
import { EnclosureService } from '../services/enclosure/enclosure.service';
import { FilamentPluginService } from '../services/filament/filament-plugin.service';
import { SocketService } from '../services/socket/socket.service';

@Component({
  selector: 'app-bottom-bar',
  templateUrl: './bottom-bar.component.html',
  styleUrls: ['./bottom-bar.component.scss'],
  //providers: [FilamentPluginService],
})
export class BottomBarComponent implements OnDestroy {
  private subscriptions: Subscription = new Subscription();
  private lastStatusText: string;

  public statusText: string;
  public enclosureTemperature: TemperatureReading;
  public currentSpool: FilamentSpool;

  public constructor(
    private socketService: SocketService,
    private configService: ConfigService,
    private enclosureService: EnclosureService,
    private notificationService: NotificationService,
    private filamentPluginService: FilamentPluginService,
  ) {
    if (this.configService.getAmbientTemperatureSensorName() !== null) {
      this.subscriptions.add(
        timer(10000, 15000).subscribe(() => {
          this.enclosureService.getEnclosureTemperature().subscribe({
            next: (temperatureReading: TemperatureReading) => (this.enclosureTemperature = temperatureReading),
            error: (error: HttpErrorResponse) => {
              this.notificationService.setNotification({
                heading: $localize`:@@error-enclosure-temp:Can't retrieve enclosure temperature!`,
                text: error.message,
                type: NotificationType.ERROR,
                time: new Date(),
              });
            },
          });
        }),
      );
    }

    this.subscriptions.add(
      timer(3000, 3000).subscribe(() => {
        this.filamentPluginService.getCurrentSpool().subscribe({
          next: (spool: FilamentSpool) => {
            console.log('updated');
            if (!this.currentSpool) {
              this.currentSpool = spool;
            }
            if (spool.name !== this.currentSpool.name) {
              console.log(spool);
              this.notificationService.setNotification({
                heading: 'Filament Changed',
                text: `Filament changed to ${spool.displayName}`,
                type: NotificationType.INFO,
                time: new Date(),
              });
            }
            this.currentSpool = spool;
          },
          error: (error: HttpErrorResponse) =>
            this.notificationService.setNotification({
              heading: $localize`:@@error-spool:Can't load active spool!`,
              text: error.message,
              type: NotificationType.ERROR,
              time: new Date(),
            }),
        });
      }),
    );

    this.subscriptions.add(
      this.socketService.getPrinterStatusSubscribable().subscribe((printerStatus: PrinterStatus): void => {
        this.setStatusText(this.getStringStatus(printerStatus?.status));
      }),
    );

    this.subscriptions.add(
      this.socketService.getPrinterStatusText().subscribe((statusText: string): void => {
        this.setStatusText(statusText);
      }),
    );
  }

  private getStringStatus(printerState: PrinterState): string {
    if (printerState === PrinterState.socketDead) {
      return 'socket is dead';
    }
    return PrinterState[printerState];
  }

  private setStatusText(statusText: string) {
    if (statusText !== this.lastStatusText) {
      this.lastStatusText = this.statusText;
      this.statusText = statusText;
    }
  }

  public getPrinterName(): string {
    return this.configService.getPrinterName();
  }

  public ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
