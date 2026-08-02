"use client";

import { Button } from "@/src/components/Button";
import { DayCard } from "@/src/components/DayCard";
import { Page } from "@/src/components/Page";
import { PageHeader } from "@/src/components/PageHeader";
import { SectionCard } from "@/src/components/SectionCard";
import { StickyActionBar } from "@/src/components/StickyActionBar";
import { useAccessToken } from "@/src/hooks/useAccessToken";
import { useDaySelections } from "@/src/hooks/useDaySelections";
import { useExport } from "@/src/hooks/useExport";
import { usePhotosPicker } from "@/src/hooks/usePhotosPicker";
import { useVideos } from "@/src/hooks/useVideos";
import { groupVideosByDay } from "@/src/lib/groupVideos";
import { requestGoogleAccessToken } from "@/src/lib/googleClient";
import { ExportOrientation } from "@/src/types/types";
import Link from "next/link";
import { useMemo, useState } from "react";

export default function Home() {
  const { accessToken, setAccessToken } = useAccessToken();
  const [showDateStamp, setShowDateStamp] = useState(true);
  const [orientation, setOrientation] =
    useState<ExportOrientation>("portrait");
  const [loginError, setLoginError] = useState<string | null>(null);

  const { sessionId, isReady, isPolling, openPicker, cancelPolling } =
    usePhotosPicker(accessToken);

  async function loginWithGoogle() {
    setLoginError(null);
    try {
      const token = await requestGoogleAccessToken();
      setAccessToken(token);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Sign-in failed");
    }
  }

  const { data: videos = [], isLoading: videosLoading } = useVideos(
    isReady ? accessToken : null,
    isReady ? sessionId : null
  );

  const videosByDay = useMemo(() => groupVideosByDay(videos), [videos]);
  const { days, selections, includedDays, updateDay } =
    useDaySelections(videosByDay);

  const { isExporting, progress, label, error, exportVideo } = useExport();

  const hasVideos = days.length > 0;

  return (
    <>
      <main className={hasVideos ? "app-main app-main--with-action" : "app-main"}>
        <div className="shell-inner">
          {!accessToken ? (
            <Page>
              <section className="surface-card login-card">
                <p className="section-label">Google Photos</p>
                <h1>Sign in to continue</h1>
                <p>
                  Pick videos from any month, choose one second per day, and
                  export a clean compilation in your browser.
                </p>
                <Button label="Continue with Google" onClick={loginWithGoogle} />
                {loginError ? (
                  <p className="muted" style={{ color: "var(--danger)" }}>
                    {loginError}
                  </p>
                ) : null}
                <p className="login-legal muted">
                  By continuing, you agree to the{" "}
                  <Link href="/terms">Terms</Link> and{" "}
                  <Link href="/privacy">Privacy Policy</Link>.
                </p>
              </section>
            </Page>
          ) : (
            <Page withActionBar={hasVideos}>
              <PageHeader
                title="Your days"
                subtitle="Select clips from Google Photos, trim each day to one second, then export."
                action={
                  accessToken ? (
                    <span className="status-pill">Signed in</span>
                  ) : null
                }
              />

              <SectionCard
                title="Source"
                subtitle="Use the Photos picker to grab videos from any date range. Days without footage are skipped."
              >
                <div className="toolbar-row">
                  <Button
                    label={
                      isPolling
                        ? "Waiting for selection…"
                        : hasVideos
                          ? "Add more from Photos"
                          : "Select videos from Google Photos"
                    }
                    variant={hasVideos ? "secondary" : "primary"}
                    onClick={openPicker}
                    disabled={isPolling || isExporting}
                  />
                </div>
                {isPolling ? (
                  <div className="picker-wait">
                    <p className="muted">
                      Finish picking in Google Photos, then return here (switch
                      tabs or use Back). Your selection will load automatically.
                    </p>
                    <Button
                      label="Cancel"
                      variant="ghost"
                      size="sm"
                      onClick={cancelPolling}
                    />
                  </div>
                ) : null}
              </SectionCard>

              {videosLoading ? (
                <p className="muted">Loading videos…</p>
              ) : null}

              {hasVideos ? (
                <>
                  <SectionCard title="Export settings">
                    <div className="settings-stack">
                      <div className="settings-block">
                        <p className="section-label">Orientation</p>
                        <p className="muted" style={{ marginTop: 4 }}>
                          Output size is 1080×1920 portrait or 1920×1080 landscape.
                          Clips are letterboxed to fit.
                        </p>
                        <div className="chip-row" style={{ marginTop: 10 }}>
                          <button
                            type="button"
                            className={`chip ${orientation === "portrait" ? "chip--active" : ""}`}
                            onClick={() => setOrientation("portrait")}
                            disabled={isExporting}
                          >
                            Portrait
                          </button>
                          <button
                            type="button"
                            className={`chip ${orientation === "landscape" ? "chip--active" : ""}`}
                            onClick={() => setOrientation("landscape")}
                            disabled={isExporting}
                          >
                            Landscape
                          </button>
                        </div>
                      </div>

                      <label className="toggle-row toggle-row--inset">
                        <div>
                          <strong>Date stamp</strong>
                          <p>Burn the day onto each second in the export.</p>
                        </div>
                        <span className="toggle">
                          <input
                            type="checkbox"
                            checked={showDateStamp}
                            onChange={(e) => setShowDateStamp(e.target.checked)}
                          />
                          <span />
                        </span>
                      </label>
                    </div>
                  </SectionCard>

                  <p className="section-label">
                    {includedDays.length} day
                    {includedDays.length === 1 ? "" : "s"} included ·{" "}
                    {includedDays.length + 1}s total
                  </p>
                  <div className="day-grid">
                    {days.map((day) => {
                      const selection = selections[day];
                      if (!selection) return null;
                      return (
                        <DayCard
                          key={day}
                          date={day}
                          videos={videosByDay[day]}
                          accessToken={accessToken}
                          selection={selection}
                          showDateStamp={showDateStamp}
                          orientation={orientation}
                          onChange={(next) => updateDay(day, next)}
                        />
                      );
                    })}
                  </div>
                </>
              ) : null}

              {error ? (
                <p className="muted" style={{ color: "var(--danger)" }}>
                  {error}
                </p>
              ) : null}
            </Page>
          )}
        </div>
      </main>

      {accessToken && hasVideos ? (
        <StickyActionBar>
          {isExporting ? (
            <>
              <p className="sticky-action__meta">{label}</p>
              <div className="progress-bar" aria-hidden>
                <div
                  className="progress-bar__fill"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
            </>
          ) : (
            <p className="sticky-action__meta">
              Export {includedDays.length}s + 1s credit · {orientation}
            </p>
          )}
          <Button
            label={
              isExporting
                ? "Exporting…"
                : `Export ${includedDays.length + 1}s ${orientation}`
            }
            disabled={isExporting || includedDays.length === 0}
            onClick={() =>
              exportVideo({
                days: includedDays,
                selections,
                videosByDay,
                accessToken,
                showDateStamp,
                orientation,
              })
            }
          />
        </StickyActionBar>
      ) : null}
    </>
  );
}
