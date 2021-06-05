import {AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, ViewChild} from '@angular/core';
import {animationFrameScheduler, BehaviorSubject, combineLatest, EMPTY, from, fromEvent, interval, Observable, of, Subject} from 'rxjs';
import {debounceTime, distinctUntilChanged, filter, map, pairwise, shareReplay, switchMap, take, takeWhile, tap} from 'rxjs/operators';
import {SwUpdate} from '@angular/service-worker';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements AfterViewInit {
  constructor(private updates: SwUpdate) {
  }

  isolatedSounds: Sound[] = [
    AppComponent.createSound('Checkout 🤑', 'checkout.mp3'),
    AppComponent.createSound('Woooowww 🎉', 'wow.mp3'),
    AppComponent.createSound('WUT?! 😨️️️️', 'alert.mp3'),
    AppComponent.createSound('AAAAAAAA 😱️', 'waaaa.mp3'),
    AppComponent.createSound('Diamond hands 💎️', 'diamond.mp3'),
    AppComponent.createSound('TumTum 📉️️️️', 'tumtumdown.mp3'),
    AppComponent.createSound('Dump it 📉', 'dumpit.mp3'),
    AppComponent.createSound('Did he buy le dip?', 'buysdip.mp3'),
    AppComponent.createSound('Finish him', 'finishhim.mp3'),
    AppComponent.createSound('Pocket money 💸', 'pocketmoney.mp3'),
    AppComponent.createSound('10%/toilet 🚽', '10perc-toilet.mp3'),
  ];

  fullSounds: Sound[] = [
    AppComponent.createSound('Checkout Woooowww 🤑🎉', 'checkoutwow.mp3'),
    AppComponent.createSound('Dump it 📉 [full]', 'dumpit-pokemon.mp3'),
    AppComponent.createSound('Buy le dip? [full]', 'buysdip-finishhim.mp3'),
    AppComponent.createSound('Diamond hands [full] 💎️', 'diamond-full.mp3'),
    AppComponent.createSound('Addicted Jimmy', 'addictedijmmy.mp3'),
  ];

  @ViewChild('player') player!: ElementRef<HTMLAudioElement>;

  private isPlayingSub = new BehaviorSubject<boolean>(false);
  isPlaying$ = this.isPlayingSub.asObservable();

  private playSub = new Subject<Sound>();
  play$ = this.playSub.asObservable().pipe(
    switchMap(sound => {
      const isPlaying = this.isPlayingSub.value;
      const isNewSound = !this.player.nativeElement.src.includes(sound.path);

      if (isNewSound) {
        this.player.nativeElement.src = sound.path;
      }

      if (isPlaying && !isNewSound) {
        this.player.nativeElement.currentTime = 0;
        return of(sound);
      }

      if (!isPlaying) {
        return this.playAudio().pipe(switchMap(() => of(sound)));
      }

      return this.isPlaying$.pipe(
        filter(_ => !_), take(1),
        switchMap(() => this.playAudio().pipe(switchMap(() => of(sound))))
      );
    }),
  );

  currPlaying$ = combineLatest([this.isPlaying$, this.play$]).pipe(
    debounceTime(20), // avoids play/stop flickering
    map(([isPlaying, sound]) => isPlaying ? sound : undefined),
    shareReplay(1)
  );

  private timeUpdateSub = new BehaviorSubject<void>(undefined);
  timeUpdate$ = this.timeUpdateSub.pipe(
    map(() => this.player.nativeElement.currentTime),
    pairwise(),
    map(([prev, curr]) => prev <= curr || curr === 0 ? curr : prev),
    distinctUntilChanged(),
    switchMap(currentTime => this.simulateProgress(currentTime * 1000)),
    map(time => [time / 1000, this.player.nativeElement.duration]),
    map(([time, duration]) => time / duration),
    filter(progress => progress >= 0 && progress <= 1),
  );

  escape$ = fromEvent(document, 'keyup').pipe(
    filter(e => (e as KeyboardEvent).key === 'Escape'),
    tap(() => this.stop())
  );

  appUpdate$ = this.updates.available.pipe(
    switchMap(() => {
      window.alert('New version available. The app will be reloaded.');
      return from(this.updates.activateUpdate());
    }),
    tap(() => document.location.reload())
  );

  static createSound(name: string, fileName: string): Sound {
    return {name, path: `assets/audio/${fileName}`};
  }

  ngAfterViewInit(): void {
    this.player.nativeElement.onplaying = () => {
      this.isPlayingSub.next(true);
    };

    this.player.nativeElement.onpause = () => {
      this.isPlayingSub.next(false);
    };

    this.player.nativeElement.onabort = () => {
      this.isPlayingSub.next(false);
    };

    this.player.nativeElement.ontimeupdate = () => {
      this.timeUpdateSub.next();
    };
  }

  play(sound: Sound): void {
    this.playSub.next(sound);
  }

  stop(): void {
    if (this.isPlayingSub.value) {
      this.player.nativeElement.pause();
      this.player.nativeElement.currentTime = 0;
    }
  }

  private playAudio(): Observable<void> {
    return of(this.isPlayingSub.value).pipe(
      switchMap(isPlaying => !isPlaying ? from(this.player.nativeElement.play()) : EMPTY)
    );
  }

  /**
   * @private
   * Simulate time updates with adding additional timestamps between
   * two real timestamps emitted by HTMLAudioElement.
   *
   * https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/timeupdate_event
   *
   * @param currentTime [ms]represents the starting point of the simulation.
   * @param targetOffset [ms] represents the predicted maximum amount of time until
   *                     next refresh.
   *
   * @return time [ms]
   */
  private simulateProgress(currentTime: number, targetOffset = 250): Observable<number> {
    const simulationStartTime = Date.now();
    return interval(0, animationFrameScheduler).pipe(
      map(() => currentTime + (Date.now() - simulationStartTime)),
      distinctUntilChanged(),
      takeWhile(time => time < currentTime + targetOffset),
    );
  }
}

interface Sound {
  name: string;
  path: string;
}
