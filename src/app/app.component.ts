import {AfterViewInit, Component, ElementRef, ViewChild} from '@angular/core';
import {BehaviorSubject, combineLatest, from, of, Subject} from 'rxjs';
import {debounceTime, filter, map, shareReplay, switchMap, take} from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements AfterViewInit {
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
        return from(this.playAudio()).pipe(switchMap(() => of(sound)));
      }

      return this.isPlaying$.pipe(
        filter(_ => !_), take(1),
        switchMap(() => from(this.playAudio()).pipe(switchMap(() => of(sound))))
      );
    }),
  );

  currPlaying$ = combineLatest([this.isPlaying$, this.play$]).pipe(
    debounceTime(20),
    map(([isPlaying, sound]) => isPlaying ? sound : undefined),
    shareReplay(1)
  );

  sounds: Sound[] = [
    AppComponent.createSound('Alert ⚠️', 'lowbudget-alert.mp3'),
    AppComponent.createSound('Woooowww 🎉', 'lowbudget-wow.mp3'),
    AppComponent.createSound('AAAAAAAA 🤬️', 'lowbudget-waaaa.mp3'),
    AppComponent.createSound('Dump it (full)', 'lowbudget-dumpit-full.mp3'),
    AppComponent.createSound('Dump it 📉', 'lowbudget-dumpit.mp3'),
  ];

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
  }

  play(sound: Sound): void {
    this.playSub.next(sound);
  }

  private playAudio(): Promise<void> {
    if (!this.isPlayingSub.value) {
      return this.player.nativeElement.play();
    }

    return new Promise(resolve => resolve());
  }

  pause(): void {
    if (this.isPlayingSub.value) {
      this.player.nativeElement.pause();
    }
  }
}

interface Sound {
  name: string;
  path: string;
}
