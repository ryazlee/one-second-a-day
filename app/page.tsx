"use client";

import { Button } from "@/src/components/Button";
import { DayCard } from "@/src/components/DayCard";
import { Landing } from "@/src/components/Landing";
import { Page } from "@/src/components/Page";
import { SectionCard } from "@/src/components/SectionCard";
import { StickyActionBar } from "@/src/components/StickyActionBar";
import { useAccessToken } from "@/src/hooks/useAccessToken";
import { useDaySelections } from "@/src/hooks/useDaySelections";
import { useExport } from "@/src/hooks/useExport";
import { usePhotosPicker } from "@/src/hooks/usePhotosPicker";
import { EMPTY_MEDIA, useVideos } from "@/src/hooks/useVideos";
import { groupVideosByDay } from "@/src/lib/groupVideos";
import { requestGoogleAccessToken } from "@/src/lib/googleClient";
import { ExportOrientation } from "@/src/types/types";
import { useMemo, useState } from "react";

export default function Home() {
  const { accessToken, setAccessToken, authReady } = useAccessToken();
  const [showDateStamp, setShowDateStamp] = useState(true);
  const [onePerDay, setOnePerDay] = useState(true);
  const [orientation, setOrientation] =
    useState<ExportOrientation>("portrait");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const { sessionId, isReady, isPolling, openPicker, cancelPolling } =
    usePhotosPicker(accessToken);

  async function loginWithGoogle() {
    setLoginError(null);
    setSigningIn(true);
    try {
      const token = await requestGoogleAccessToken("consent");
      setAccessToken(token.accessToken, token.expiresIn);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setSigningIn(false);
    }
  }

  const { data, isLoading: videosLoading, isError, error: videosError } =
    useVideos(isReady ? accessToken : null, isReady ? sessionId : null);
  const media = data ?? EMPTY_MEDIA;

  const mediaByDay = useMemo(() => groupVideosByDay(media), [media]);
  const { days, selections, includedDays, includedClipCount, updateDay } =
    useDaySelections(mediaByDay, onePerDay);

  const { isExporting, progress, label, error, exportVideo } = useExport();

  const hasMedia = days.length > 0;
  const exportSeconds = includedClipCount + 1;

  if (!authReady) {
    return (
      <main className="app-main">
        <div className="shell-inner">
          <p className="muted" style={{ textAlign: "center", padding: "3rem 0" }}>
            Loading…
          </p>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className={hasMedia ? "app-main app-main--with-action" : "app-main"}>
        <div className="shell-inner">
          {!accessToken ? (
            <Page>
              <Landing
                onLogin={loginWithGoogle}
                loginError={loginError}
                signingIn={signingIn}
              />
            </Page>
          ) : (
            <Page withActionBar={hasMedia}>
              <SectionCard title="Source">
                <div className="toolbar-row">
                  <Button
                    label={
                      isPolling
                        ? "Waiting for selection…"
                        : hasMedia
                          ? "Add more from Photos"
                          : "Select from Google Photos"
                    }
                    variant={hasMedia ? "secondary" : "primary"}
                    onClick={openPicker}
                    disabled={isPolling || isExporting}
                  />
                </div>
                {isPolling ? (
                  <div className="picker-wait">
                    <p className="muted">
                      Finish in Google Photos, then return here.
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
                <p className="muted">Loading media…</p>
              ) : null}

              {isError ? (
                <p className="muted" style={{ color: "var(--danger)" }}>
                  {videosError instanceof Error
                    ? videosError.message
                    : "Couldn’t load your Photos selection."}
                </p>
              ) : null}

              {hasMedia ? (
                <>
                  <SectionCard title="Export">
                    <div className="settings-stack">
                      <div className="settings-block">
                        <p className="section-label">Orientation</p>
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
                          <strong>One clip per day</strong>
                          <p>Off allows multiple seconds from the same day.</p>
                        </div>
                        <span className="toggle">
                          <input
                            type="checkbox"
                            checked={onePerDay}
                            onChange={(e) => setOnePerDay(e.target.checked)}
                            disabled={isExporting}
                          />
                          <span />
                        </span>
                      </label>

                      <label className="toggle-row toggle-row--inset">
                        <div>
                          <strong>Date stamp</strong>
                          <p>Burn the day onto each second.</p>
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
                    {includedClipCount} clip
                    {includedClipCount === 1 ? "" : "s"} · {exportSeconds}s
                  </p>
                  <div className="day-grid">
                    {days.map((day) => {
                      const selection = selections[day];
                      if (!selection) return null;
                      return (
                        <DayCard
                          key={day}
                          date={day}
                          items={mediaByDay[day]}
                          accessToken={accessToken}
                          selection={selection}
                          showDateStamp={showDateStamp}
                          orientation={orientation}
                          onePerDay={onePerDay}
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

      {accessToken && hasMedia ? (
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
              {includedClipCount}s + 1s credit · {orientation}
            </p>
          )}
          <Button
            label={
              isExporting
                ? "Exporting…"
                : `Export ${exportSeconds}s`
            }
            disabled={isExporting || includedClipCount === 0}
            onClick={() =>
              exportVideo({
                days: includedDays,
                selections,
                videosByDay: mediaByDay,
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
