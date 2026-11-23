
import { useCallback, useEffect, useRef, useState } from 'react';
import { audio } from './game/audio';
import { Game, type Snapshot } from './game/game';
import { MAP_SIZES, type MapSize, type MapType } from './game/meta';
import { DevPanel } from './ui/DevPanel';
import { EconomyPanel } from './ui/EconomyPanel';
import { Hud } from './ui/Hud';
import { HelpModal, MainMenu, randomName, type Setup } from './ui/MainMenu';
import { SettingsModal } from './ui/Settings';
import { TechTree } from './ui/TechTree';
import { GovModal, WorldPanel } from './ui/WorldPanel';
import { CourtPanel } from './ui/CourtPanel';
import { LifePanel } from './ui/LifePanel';
import { HintCard, TutorialCard, loadSeenHints, loadTutorialPref, resetSeenHints, saveSeenHint, saveTutorialPref } from './ui/Onboarding';
import { RealmPanel, type RealmTab } from './ui/RealmPanel';
import { EndScreen } from './ui/EndScreen';
import { SavesModal } from './ui/SavesModal';
import { listSaves, loadGame, saveGame, type SaveMeta } from './game/saves';
import { UiScaleContext, loadUiScale, saveUiScale } from './ui/uiScale';

const randomSeed = () => Math.floor(1000 + Math.random() * 998000);
type Panel = 'none' | 'tree' | 'world' | 'pause' | 'eco' | 'court' | 'life' | 'realm';

const GUIDE_KEY = 'zarya_guide_on';
function loadGuidePref(): boolean {
  try {
    return localStorage.getItem(GUIDE_KEY) !== '0';
  } catch {
    return true;
  }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [screen, setScreen] = useState<'menu' | 'play'>('menu');
  const [step, setStep] = useState<'main' | 'setup'>('main');
  const [busy, setBusy] = useState(true);
  const [guideOn, setGuideOnState] = useState(loadGuidePref);
  const [setup, setSetup] = useState<Setup>({ name: randomName(), spec: 'farmer', size: 'medium', type: 'continents', seed: String(randomSeed()), diff: 'normal', tutorial: loadTutorialPref() && loadGuidePref() });
  const [realmTab, setRealmTab] = useState<RealmTab>('chron');
  const [showSaves, setShowSaves] = useState(false);
  const [latestSave, setLatestSave] = useState<SaveMeta | null>(null);
  const [saveFlash, setSaveFlash] = useState<string | null>(null);
  const [tutOn, setTutOn] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState('');
  const [panel, setPanel] = useState<Panel>('none');
  const [worldFocus, setWorldFocus] = useState<number | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [buildOpen, setBuildOpen] = useState(false);
  const [intro, setIntro] = useState(false);
  const [audioOn, setAudioOn] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [devMode, setDevMode] = useState(() => {
    try {
      return localStorage.getItem('zarya_dev') === '1';
    } catch {
      return false;
    }
  });
  const [devOpen, setDevOpen] = useState(false);
  const [vols, setVolsState] = useState({ m: audio.musicVol, s: audio.sfxVol });
  const [uiScale, setUiScaleState] = useState(loadUiScale);
  const [uiHidden, setUiHidden] = useState(false);
  const setUiScale = (v: number) => {
    setUiScaleState(v);
    saveUiScale(v);
  };

  const gameRef = useRef<Game | null>(null);
  const loadId = useRef(0);
  const refs = useRef({ saves: false, screen: 'menu' as 'menu' | 'play', realmTab: 'chron' as RealmTab, panel: 'none' as Panel, settings: false, dev: false, devOpen: false, help: false, build: false, prevPaused: false, govPaused: false, setup });
  refs.current.panel = panel;
  refs.current.saves = showSaves;
  refs.current.screen = screen;
  refs.current.realmTab = realmTab;
  refs.current.help = showHelp;
  refs.current.settings = showSettings;
  refs.current.dev = devMode;
  refs.current.devOpen = devOpen;
  refs.current.build = buildOpen;
  refs.current.setup = setup;

  const sizeN = (s: MapSize) => MAP_SIZES.find((x) => x.id === s)!.n;

  const load = useCallback((seed: number, size: MapSize, type: MapType, then?: () => void) => {
    setBusy(true);
    const id = ++loadId.current;
    setTimeout(() => {
      // устаревший запрос (например, двойной вызов эффекта) — пропускаем
      if (id !== loadId.current) return;
      const g = gameRef.current;
      let ok = false;
      try {
        if (g) {
          g.loadWorld(seed, MAP_SIZES.find((x) => x.id === size)!.n, type);
          setLoadedKey(`${seed}|${size}|${type}`);
          ok = true;
        }
      } catch (err) {
        console.error('Ошибка генерации мира', err);
      } finally {
        // экран загрузки не должен зависать при любой ошибке
        setBusy(false);
      }
      if (ok) then?.();
    }, 60);
  }, []);

  const openPanel = useCallback((p: Panel) => {
    const g = gameRef.current;
    if (!g) return;
    if (refs.current.panel === 'none') {
      refs.current.prevPaused = g.paused;
      g.setPaused(true);
    }
    setBuildOpen(false);
    if (p === 'tree' || p === 'realm') audio.play('parchment');
    setPanel(p);
  }, []);

  const closePanel = useCallback(() => {
    const g = gameRef.current;
    if (g && refs.current.panel !== 'none') g.setPaused(refs.current.prevPaused);
    setPanel('none');
    setWorldFocus(null);
  }, []);

  const openWorld = useCallback(
    (id?: number) => {
      setWorldFocus(id ?? null);
      if (refs.current.panel === 'none') openPanel('world');
      else setPanel('world');
    },
    [openPanel],
  );

  useEffect(() => {
    const canvas = canvasRef.current!;
    const g = new Game(canvas);
    gameRef.current = g;
    (window as unknown as { __zarya?: Game }).__zarya = g;
    (window as unknown as { __zaryaSaves?: unknown }).__zaryaSaves = { saveGame, loadGame, listSaves };
    g.resize();
    g.attach();
    g.onUpdate = (s) => setSnap(s);
    g.onOpenTown = (id) => openWorld(id);
    g.onHotkey = (k) => {
      const f = refs.current;
      if (k === 'tree') {
        if (f.panel === 'tree') closePanel();
        else if (f.panel === 'none') openPanel('tree');
      } else if (k === 'world') {
        if (f.panel === 'world') closePanel();
        else if (f.panel === 'none') openWorld();
      } else if (k === 'eco') {
        if (f.panel === 'eco') closePanel();
        else if (f.panel === 'none') openPanel('eco');
      } else if (k === 'court') {
        if (f.panel === 'court') closePanel();
        else if (f.panel === 'none') openPanel('court');
      } else if (k === 'life') {
        if (f.panel === 'life') closePanel();
        else if (f.panel === 'none') openPanel('life');
      } else if (k === 'realm' || k === 'ach') {
        const tab: RealmTab = k === 'ach' ? 'ach' : 'chron';
        if (f.panel === 'realm' && f.realmTab === tab) closePanel();
        else if (f.panel === 'realm') setRealmTab(tab);
        else if (f.panel === 'none') {
          setRealmTab(tab);
          openPanel('realm');
        }
      } else if (k === 'hideui') {
        setUiHidden((v) => !v);
      } else if (k === 'dev') {
        if (f.dev) setDevOpen((v) => !v);
      } else if (k === 'build') {
        if (f.panel === 'none') setBuildOpen((v) => !v);
      } else if (k === 'escape') {
        if (f.saves) setShowSaves(false);
        else if (f.settings) setShowSettings(false);
        else if (f.help) setShowHelp(false);
        else if (f.panel !== 'none') closePanel();
        else if (f.build) setBuildOpen(false);
        else openPanel('pause');
      }
    };
    g.start();
    setGame(g);
    const ro = new ResizeObserver(() => g.resize());
    ro.observe(canvas);
    const st = refs.current.setup;
    load(parseInt(st.seed) || randomSeed(), st.size, st.type);
    const unlock = () => {
      audio.unlock();
      setAudioOn(audio.running);
    };
    window.addEventListener('click', unlock);
    window.addEventListener('keydown', unlock);
    const poll = window.setInterval(() => setAudioOn(audio.running), 500);
    return () => {
      ro.disconnect();
      g.stop();
      g.detach();
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
      window.clearInterval(poll);
    };
  }, [load, openPanel, closePanel, openWorld]);

  // выбор формы правления — обязательное окно
  const govOpen = !!snap && screen === 'play' && snap.provinces > 0 && !snap.gov;
  useEffect(() => {
    const g = gameRef.current;
    if (!g) return;
    if (govOpen && !refs.current.govPaused) {
      refs.current.govPaused = true;
      if (refs.current.panel === 'none') refs.current.prevPaused = g.paused;
      g.setPaused(true);
    } else if (!govOpen && refs.current.govPaused) {
      refs.current.govPaused = false;
      if (refs.current.panel === 'none') g.setPaused(refs.current.prevPaused);
    }
  }, [govOpen]);

  useEffect(() => {
    if (gameRef.current) gameRef.current.uiLock = panel !== 'none' || govOpen;
  }, [panel, govOpen]);

  // «Первое знакомство»: один раз показываем карточку «Как это работает»
  const estateCount = snap?.soc.estates.length ?? 0;
  const hasGov = !!snap?.gov;
  useEffect(() => {
    if (screen !== 'play' || hint || !guideOn) return;
    const seen = loadSeenHints();
    let want: string | null = null;
    if ((panel === 'court' || panel === 'eco' || panel === 'life' || panel === 'world') && !seen[panel]) want = panel;
    else if (panel === 'none' && estateCount > 0 && !seen.manor) want = 'manor';
    else if (panel === 'none' && hasGov && !seen.gov) want = 'gov';
    if (want) setHint(want);
  }, [panel, screen, hint, estateCount, hasGov, guideOn]);

  const setGuideOn = (v: boolean) => {
    setGuideOnState(v);
    try {
      localStorage.setItem(GUIDE_KEY, v ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (!v) {
      setHint(null);
      setTutOn(false);
      setSetup((st) => ({ ...st, tutorial: false }));
    } else if (refs.current.screen === 'play') {
      let done = false;
      try {
        done = localStorage.getItem('zarya_tutorial_done') === '1';
      } catch {
        /* ignore */
      }
      if (!done) setTutOn(true);
    }
  };
  const closeHint = () => {
    if (hint) saveSeenHint(hint);
    setHint(null);
  };

  const startNew = () => {
    const g = gameRef.current;
    if (!g) return;
    const seed = parseInt(setup.seed) || randomSeed();
    const key = `${seed}|${setup.size}|${setup.type}`;
    const begin = () => {
      g.startGame({ name: setup.name, spec: setup.spec, diff: setup.diff });
      audio.unlock();
      setScreen('play');
      setPanel('none');
      setBuildOpen(false);
      if (setup.tutorial && !guideOn) setGuideOn(true);
      setTutOn(setup.tutorial);
      saveTutorialPref(setup.tutorial);
      setHint(null);
      setIntro(true);
      setTimeout(() => setIntro(false), 7000);
    };
    if (key !== loadedKey) load(seed, setup.size, setup.type, begin);
    else begin();
  };

  const afterLoad = () => {
    setScreen('play');
    setPanel('none');
    setBuildOpen(false);
    setTutOn(false);
    setHint(null);
    setIntro(false);
    setUiHidden(false);
    setShowSaves(false);
    setShowSettings(false);
    setStep('main');
    audio.unlock();
  };

  const refreshLatest = useCallback(() => {
    listSaves().then((m) => {
      const all = Object.values(m).sort((a, b) => b.at - a.at);
      setLatestSave(all[0] ?? null);
    });
  }, []);
  useEffect(refreshLatest, [refreshLatest, screen]);

  // автосохранение: каждые 45 с, при сворачивании и закрытии вкладки
  useEffect(() => {
    const doSave = (flash: boolean) => {
      const g = gameRef.current;
      if (!g || refs.current.screen !== 'play' || g.mode !== 'play' || g.gameOver || g.time < 3) return;
      saveGame(g, 'auto')
        .then(() => {
          if (flash) {
            setSaveFlash('⟳ Автосохранено');
            setTimeout(() => setSaveFlash(null), 1600);
          }
        })
        .catch(() => undefined);
    };
    const iv = window.setInterval(() => doSave(true), 45000);
    const onHide = () => {
      if (document.visibilityState === 'hidden') doSave(false);
    };
    const onPageHide = () => doSave(false);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onPageHide);
    return () => {
      window.clearInterval(iv);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onPageHide);
    };
  }, []);

  const continueGame = async () => {
    const g = gameRef.current;
    if (!g || !latestSave) return;
    setBusy(true);
    try {
      const ok = await loadGame(g, latestSave.id);
      if (ok) afterLoad();
    } finally {
      setBusy(false);
    }
  };

  const toMenu = () => {
    setTutOn(false);
    setHint(null);
    setPanel('none');
    setScreen('menu');
    setUiHidden(false);
    setStep('main');
    const seed = randomSeed();
    setSetup((s) => ({ ...s, seed: String(seed), name: s.name }));
    load(seed, setup.size, setup.type);
  };

  const onDevCode = (on: boolean) => {
    setDevMode(on);
    if (!on) setDevOpen(false);
    try {
      localStorage.setItem('zarya_dev', on ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (on && screen === 'play') setDevOpen(true);
  };

  const setVols = (m: number, s: number) => {
    setVolsState({ m, s });
    audio.setVolumes(m, s);
  };

  void sizeN;

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-[#0d1a2a]"
      onClickCapture={(e) => {
        if ((e.target as HTMLElement).closest('button')) audio.play('click');
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />

      <UiScaleContext.Provider value={uiScale}>
      <div className="ui-layer pointer-events-none absolute inset-0" style={{ zoom: uiScale }}>

      {screen === 'menu' && !busy && (
        <MainMenu
          step={step}
          setStep={setStep}
          setup={setup}
          setSetup={setSetup}
          onSize={(s) => {
            setSetup({ ...setup, size: s });
            load(parseInt(setup.seed) || randomSeed(), s, setup.type);
          }}
          onType={(t) => {
            setSetup({ ...setup, type: t });
            load(parseInt(setup.seed) || randomSeed(), setup.size, t);
          }}
          onStart={startNew}
          onReroll={() => {
            const sd = randomSeed();
            setSetup({ ...setup, seed: String(sd) });
            load(sd, setup.size, setup.type);
          }}
          onHelp={() => setShowHelp(true)}
          onSettings={() => setShowSettings(true)}
          onContinue={continueGame}
          onLoad={() => setShowSaves(true)}
          continueInfo={latestSave ? `«${latestSave.name}» · день ${latestSave.day} · ${latestSave.season}` : null}
          devMode={devMode}
          busy={busy}
          audioOn={audioOn}
          onUnlock={() => {
            audio.unlock();
            setAudioOn(audio.running);
          }}
        />
      )}

      {screen === 'play' && snap && snap.mode === 'play' && uiHidden && (
        <button
          onClick={() => setUiHidden(false)}
          title="Показать интерфейс (H)"
          className="px-btn font-pixel absolute top-2 right-2 z-10 flex items-center gap-2 px-2.5 py-2 text-[9px] opacity-60 hover:opacity-100"
        >
          👁 <span className="hidden sm:inline">ПОКАЗАТЬ [H]</span>
        </button>
      )}

      {screen === 'play' && game && snap && snap.mode === 'play' && !uiHidden && (
        <Hud onHide={() => setUiHidden(true)} game={game} snap={snap} buildOpen={buildOpen} setBuildOpen={setBuildOpen} openTree={() => openPanel('tree')} openMenu={() => openPanel('pause')} openWorld={openWorld} openEco={() => openPanel('eco')} openCourt={() => openPanel('court')} openLife={() => openPanel('life')} openRealm={() => { setRealmTab('chron'); openPanel('realm'); }} devMode={devMode} devOpen={devOpen} toggleDev={() => setDevOpen((v) => !v)} />
      )}

      {intro && screen === 'play' && snap && !uiHidden && (
        <div className="pointer-events-none absolute inset-x-0 top-[28%] z-20 flex justify-center px-4">
          <div className="fade-up px-panel-dark max-w-[640px] px-6 py-5 text-center">
            <div className="font-pixel text-[12px] leading-relaxed text-[#ffe9a8] sm:text-[14px]">«{snap.name.toUpperCase()}» ОСНОВАНО</div>
            <div className="mt-3 text-[16px] text-[#e8d4a8]">Рубите деревья (ПКМ по дереву), собирайте ягоды и изучайте знания — [T]. Соседние селения — на карте, дипломатия и война — [V].</div>
          </div>
        </div>
      )}

      {tutOn && guideOn && screen === 'play' && game && snap && snap.mode === 'play' && !uiHidden && !snap.gameOver && <TutorialCard game={game} snap={snap} onExit={() => setTutOn(false)} />}
      {hint && guideOn && screen === 'play' && <HintCard id={hint} onClose={closeHint} />}

      {devMode && devOpen && !uiHidden && screen === 'play' && game && snap && snap.mode === 'play' && <DevPanel game={game} snap={snap} onClose={() => setDevOpen(false)} />}
      {panel === 'eco' && game && snap && <EconomyPanel game={game} snap={snap} onClose={closePanel} />}
      {panel === 'life' && game && snap && <LifePanel game={game} snap={snap} onClose={closePanel} />}
      {panel === 'court' && game && snap && <CourtPanel game={game} snap={snap} onClose={closePanel} />}
      {panel === 'realm' && game && snap && <RealmPanel game={game} snap={snap} tab={realmTab} setTab={setRealmTab} onClose={closePanel} />}
      {panel === 'tree' && game && snap && <TechTree game={game} snap={snap} onClose={closePanel} />}
      {panel === 'world' && game && snap && <WorldPanel game={game} snap={snap} focusId={worldFocus} onClose={closePanel} />}
      {govOpen && game && snap && <GovModal game={game} snap={snap} />}

      {panel === 'pause' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/65 p-4">
          <div className="px-panel flex w-[360px] flex-col gap-4 p-6">
            <h2 className="font-pixel text-center text-[14px] text-[#ffe9a8]">ПАУЗА</h2>
            <button onClick={closePanel} className="px-btn px-btn-green font-pixel px-4 py-3 text-[11px] text-white">
              ▶ ПРОДОЛЖИТЬ
            </button>
            <button onClick={() => setShowSaves(true)} className="px-btn px-btn-gold font-pixel px-4 py-3 text-[10px]">
              💾 СОХРАНИТЬ / ЗАГРУЗИТЬ
            </button>
            <button onClick={() => setShowSettings(true)} className="px-btn font-pixel px-4 py-3 text-[10px]">
              ⚙ НАСТРОЙКИ
            </button>
            <button onClick={() => setShowHelp(true)} className="px-btn font-pixel px-4 py-3 text-[10px]">
              ? КАК ИГРАТЬ
            </button>
            <button onClick={toMenu} className="px-btn px-btn-red font-pixel px-4 py-3 text-[10px]">
              ⌂ В ГЛАВНОЕ МЕНЮ
            </button>
          </div>
        </div>
      )}

      {snap?.gameOver && screen === 'play' && game && <EndScreen game={game} snap={snap} mode="defeat" onMenu={toMenu} />}
      {snap && game && screen === 'play' && !snap.gameOver && snap.ext.victory && !snap.ext.victoryDismissed && (
        <EndScreen
          game={game}
          snap={snap}
          mode="victory"
          onMenu={toMenu}
          onContinue={() => {
            game.ext.victoryDismissed = true;
            game.setPaused(false);
            game.msg('Вы продолжаете играть после победы — история не закончена!', 'info');
            game.emit(true);
          }}
        />
      )}
      {saveFlash && screen === 'play' && <div className="font-pixel pointer-events-none absolute bottom-[170px] left-3 z-20 bg-[#0f0906cc] px-3 py-2 text-[8px] text-[#8aff9a]">{saveFlash}</div>}

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {showSaves && game && <SavesModal game={game} canSave={screen === 'play' && !snap?.gameOver} onClose={() => setShowSaves(false)} onLoaded={afterLoad} />}
      {showSettings && <SettingsModal guideOn={guideOn} setGuideOn={setGuideOn} onResetHints={resetSeenHints} uiScale={uiScale} setUiScale={setUiScale} vols={vols} setVols={setVols} devMode={devMode} onDevCode={onDevCode} onClose={() => setShowSettings(false)} />}

      {busy && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-[#0b0806]">
          <div className="spin-px h-10 w-10" style={{ boxShadow: '0 0 0 4px #ffcf6a inset, 0 0 0 4px #ffcf6a', clipPath: 'polygon(0 0,100% 0,100% 40%,60% 40%,60% 100%,0 100%)' }} />
          <div className="font-pixel text-[11px] text-[#ffe9a8]">СОТВОРЕНИЕ МИРА…</div>
        </div>
      )}
      </div>
      </UiScaleContext.Provider>
    </div>
  );
}
