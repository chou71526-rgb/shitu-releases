import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { AppRoute, AppSettings, LibraryImage } from "../shared/types";
import { NavigationDrawer } from "./components/NavigationDrawer";
import { DetailPage } from "./pages/DetailPage";
import { JournalPage } from "./pages/JournalPage";
import { LibraryPage } from "./pages/LibraryPage";
import { PetPage } from "./pages/PetPage";
import { SettingsPage } from "./pages/SettingsPage";
import { LibraryFeedback } from "./components/LibraryFeedback";

gsap.registerPlugin(useGSAP);

function hashRoute(): { route: AppRoute | "pet"; id?: string } {
  const value = location.hash.replace(/^#\//, "");
  if (value === "pet") return { route: "pet" };
  if (value.startsWith("detail/")) return { route: "detail", id: value.slice(7) };
  if (["journal", "settings", "trash"].includes(value)) return { route: value as AppRoute };
  return { route: "library" };
}

export function App() {
  const [locationState, setLocationState] = useState(hashRoute);
  const [drawer, setDrawer] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [images, setImages] = useState<LibraryImage[]>([]);
  const stageRef = useRef<HTMLDivElement>(null);

  const refresh = async () => setImages(await window.appApi.listImages());
  useLayoutEffect(() => { document.documentElement.dataset.window = locationState.route === "pet" ? "pet" : "main"; }, [locationState.route]);
  useEffect(() => {
    const listener = () => setLocationState(hashRoute());
    addEventListener("hashchange", listener);
    if (locationState.route !== "pet") { void refresh(); void window.appApi.getSettings().then(setSettings); }
    return () => removeEventListener("hashchange", listener);
  }, []);

  useEffect(() => {
    if (locationState.route === "pet") return;
    return window.appApi.onLibraryChanged(refresh);
  }, [locationState.route]);

  useEffect(() => {
    if (!settings) return;
    const dark = settings.theme === "dark" || (settings.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.dataset.motion = settings.reducedMotion ? "reduced" : "full";
  }, [settings]);

  useGSAP(() => {
    if (!settings || settings.reducedMotion || locationState.route === "pet") return;
    gsap.fromTo(".page-stage > main, .page-stage > div:not([hidden]) > main", { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: .48, ease: "power3.out", clearProps: "transform,opacity,visibility" });
  }, { scope: stageRef, dependencies: [locationState.route, locationState.id, settings?.reducedMotion] });

  if (locationState.route === "pet") return <PetPage />;
  const navigate = (route: AppRoute, id?: string) => { location.hash = route === "detail" ? `#/detail/${id}` : `#/${route === "library" ? "" : route}`; setDrawer(false); };
  const common = { onMenu: () => setDrawer(true), settings: settings!, onSettings: setSettings };
  return <LibraryFeedback><div className="app-shell">
    <div className="page-stage" ref={stageRef}>
      {settings && <div hidden={locationState.route !== "library"}><LibraryPage {...common} active={locationState.route === "library"} images={images} refresh={refresh} onOpen={(id) => navigate("detail", id)} /></div>}
      {locationState.route === "detail" && locationState.id && settings && <DetailPage {...common} onRestored={refresh} id={locationState.id} onOpen={(id) => navigate("detail", id)} onBack={() => history.back()} onDeleted={async () => { await refresh(); navigate("library"); }} />}
      {locationState.route === "journal" && settings && <JournalPage {...common} images={images} refresh={refresh} onOpen={(id) => navigate("detail", id)} />}
      {(locationState.route === "settings" || locationState.route === "trash") && settings && <SettingsPage {...common} refreshLibrary={refresh} />}
    </div>
    <NavigationDrawer open={drawer} onClose={() => setDrawer(false)} current={locationState.route} navigate={navigate} aiMode={settings?.aiMode ?? "automatic"} />
  </div></LibraryFeedback>;
}
