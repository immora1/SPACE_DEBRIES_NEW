import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { AnimatePresence, motion } from 'framer-motion'
import gsap from 'gsap'
import * as THREE from 'three'
import useAppStore from '../../store/useAppStore'
import {
  generateGameDecisionFeedback,
  generateGameReflection,
} from '../../services/ai'
import { calcInitialArmor, evaluateResult, pickEvents } from './gameData'
import ReflectionPage from './ReflectionPage'

const EARTH_GLB = '/earth%20globe%203d%20model.glb'
const SATELLITE_GLB = '/simple_satellite_low_poly_free.glb'
const EARTH_SCALE = 1
const MIN_EARTH_SCALE = 1.6
const EXPANDED_EARTH_SCALE = 3
const PERSONAL_ORBIT_SPEED = 0.075
const PERSONAL_SATELLITE_SIZE = 0.1
const ORBITAL_DEBRIS_BASE_COUNT = 2000
const ORBITAL_DEBRIS_MAX_COUNT = 2600
const ORBIT_VIEWBOX_SIZE = 1000
const ORBIT_CENTER_X = 500
const ORBIT_CENTER_Y = 500
const ORBIT_RADIUS_X = 205
const ORBIT_RADIUS_Y = 150
const ORBIT_LEFT_X = ORBIT_CENTER_X - ORBIT_RADIUS_X
const ORBIT_RIGHT_X = ORBIT_CENTER_X + ORBIT_RADIUS_X
const ORBIT_FRONT_PATH = `M ${ORBIT_LEFT_X} ${ORBIT_CENTER_Y} A ${ORBIT_RADIUS_X} ${ORBIT_RADIUS_Y} 0 0 0 ${ORBIT_RIGHT_X} ${ORBIT_CENTER_Y}`
const TOTAL_ROUNDS = 6
const GAME_MONTHS = [1, 3, 5, 7, 9, 12]
const GAME_PHASE = {
  EVENT: 'event',
  FEEDBACK: 'feedback',
  REFLECTION: 'reflection',
}
const THREAT_LABELS = {
  debris_approach: 'DEBRIS APPROACH',
  solar_storm: 'SOLAR STORM',
  orbital_decay: 'ORBITAL DECAY',
  cascade_fragment: 'CASCADE FRAGMENT',
  fuel_leak: 'FUEL LEAK',
}
const MotionAside = motion.aside
const MotionDiv = motion.div
const GUIDE_STYLES = `
  @keyframes m4-guide-pulse {
    0%, 100% { opacity: 0.2; transform: scale(0.92); }
    50% { opacity: 0.62; transform: scale(1.2); }
  }

  @keyframes m4-guide-arrow {
    0%, 100% { transform: translateX(-2px); }
    50% { transform: translateX(4px); }
  }

  @keyframes m4-guide-signal {
    0%, 100% { opacity: 0.32; }
    50% { opacity: 0.84; }
  }

  .m4-start-guide {
    position: absolute;
    top: 50%;
    z-index: 3;
    width: min(360px, calc(25vw - clamp(34px, 6vw, 116px) - 28px));
    color: #f4f4ff;
    pointer-events: none;
    transform: translateY(-50%);
    transition: opacity 180ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .m4-start-guide-left {
    left: clamp(24px, 4vw, 78px);
  }

  .m4-start-guide-right {
    right: clamp(34px, 6vw, 116px);
  }

  .m4-guide-eyebrow {
    margin: 0;
    color: rgba(232,232,248,0.5);
    font-family: "Space Mono", monospace;
    font-size: 9px;
    letter-spacing: 0.2em;
    line-height: 1.8;
  }

  .m4-guide-number {
    display: flex;
    align-items: baseline;
    gap: 14px;
    margin: 18px 0 14px;
  }

  .m4-guide-number strong {
    color: #f4f4ff;
    font-family: "Lexend", sans-serif;
    font-size: clamp(68px, 7vw, 112px);
    font-weight: 400;
    letter-spacing: -0.14em;
    line-height: 0.82;
  }

  .m4-guide-number span {
    color: rgba(232,232,248,0.72);
    font-family: "Noto Sans SC", sans-serif;
    font-size: 14px;
    letter-spacing: 0.18em;
  }

  .m4-guide-rule {
    position: relative;
    width: 100%;
    height: 1px;
    margin: 0 0 13px;
    background: #f4f4ff;
  }

  .m4-guide-rule::after {
    position: absolute;
    top: -3px;
    right: 0;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #f4f4ff;
    content: "";
  }

  .m4-guide-kicker {
    margin: 0;
    color: rgba(232,232,248,0.62);
    font-family: "Space Mono", monospace;
    font-size: 9px;
    letter-spacing: 0.12em;
    line-height: 1.8;
  }

  .m4-guide-icon {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 18px;
    color: rgba(244,244,255,0.82);
  }

  .m4-guide-icon::after {
    width: 56px;
    height: 1px;
    background: #f4f4ff;
    content: "";
  }

  .m4-start-guide h2 {
    margin: 0 0 12px;
    color: #f4f4ff;
    font-family: "Noto Sans SC", sans-serif;
    font-size: clamp(20px, 2vw, 30px);
    font-weight: 400;
    letter-spacing: 0.08em;
  }

  .m4-start-guide p {
    margin: 0;
    color: rgba(232,232,248,0.68);
    font-family: "Noto Sans SC", sans-serif;
    font-size: 13px;
    letter-spacing: 0.08em;
    line-height: 1.9;
  }

  .m4-guide-action {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 18px;
    color: rgba(139,108,248,0.88);
    font-family: "Space Mono", monospace;
    font-size: 9px;
    letter-spacing: 0.18em;
  }

  .m4-guide-action::before {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #8b6cf8;
    content: "";
    animation: m4-guide-signal 1.8s ease-in-out infinite;
  }

  .m4-orbit-handle-halo {
    position: absolute;
    inset: -12px;
    border: 1px solid rgba(139,108,248,0.72);
    border-radius: 50%;
    animation: m4-guide-pulse 1.9s ease-in-out infinite;
    pointer-events: none;
  }

  .m4-orbit-handle-arrow {
    width: 18px;
    height: 18px;
    color: #111126;
    animation: m4-guide-arrow 1.2s cubic-bezier(0.25, 1, 0.5, 1) infinite;
    pointer-events: none;
  }

  .m4-orbit-static-hint {
    position: absolute;
    top: 81%;
    left: 50%;
    display: flex;
    flex-direction: column;
    gap: 5px;
    color: rgba(244,244,255,0.92);
    font-family: "Noto Sans SC", sans-serif;
    font-size: 12px;
    letter-spacing: 0.14em;
    text-align: center;
    transform: translateX(-50%);
    white-space: nowrap;
    pointer-events: none;
  }

  .m4-orbit-static-hint small {
    color: rgba(232,232,248,0.5);
    font-family: "Space Mono", monospace;
    font-size: 8px;
    letter-spacing: 0.18em;
  }

  @media (max-width: 960px) {
    .m4-start-guide {
      width: min(210px, calc(25vw - clamp(24px, 5vw, 58px) - 16px));
    }

    .m4-start-guide-left {
      left: clamp(24px, 5vw, 58px);
    }

    .m4-start-guide-right {
      right: clamp(24px, 5vw, 58px);
    }

    .m4-start-guide-right p {
      display: none;
    }

    .m4-guide-action {
      margin-top: 10px;
    }
  }

  @media (max-width: 720px) {
    .m4-start-guide-left {
      top: 48px;
      left: 24px;
      width: 190px;
      transform: none;
    }

    .m4-guide-number {
      margin-top: 12px;
    }

    .m4-start-guide-right {
      top: auto;
      right: 24px;
      bottom: 42px;
      left: 24px;
      width: auto;
      transform: none;
    }

    .m4-guide-icon,
    .m4-start-guide-right p {
      display: none;
    }

    .m4-start-guide h2 {
      margin-bottom: 0;
      font-size: 17px;
    }

    .m4-guide-action {
      margin-top: 9px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .m4-orbit-handle-halo,
    .m4-orbit-handle-arrow,
    .m4-guide-action::before {
      animation: none;
    }
  }
`
const GAME_STYLES = `
  .m4-game-panel {
    position: absolute;
    top: 50%;
    right: 18px;
    z-index: 5;
    width: min(390px, 31vw);
    max-height: min(760px, 86vh);
    overflow: auto;
    color: #15151d;
    background: rgba(250,249,246,0.96);
    border: 1px solid rgba(255,255,255,0.72);
    box-shadow: 0 18px 60px rgba(0,0,0,0.2);
    transform: translateY(-50%);
  }

  .m4-game-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 17px 20px 14px;
    border-bottom: 1px solid rgba(21,21,29,0.12);
  }

  .m4-game-label {
    color: rgba(21,21,29,0.52);
    font-family: "Lexend", sans-serif;
    font-size: 8px;
    letter-spacing: 0.16em;
    line-height: 1.6;
    text-transform: uppercase;
  }

  .m4-game-panel-body {
    padding: 18px 20px 20px;
  }

  .m4-game-panel h2 {
    margin: 10px 0 10px;
    color: #15151d;
    font-family: "Noto Serif SC", serif;
    font-size: 22px;
    font-weight: 400;
    letter-spacing: 0.02em;
    line-height: 1.45;
  }

  .m4-game-panel p {
    margin: 0;
    color: rgba(21,21,29,0.66);
    font-family: "Noto Sans SC", sans-serif;
    font-size: 12px;
    line-height: 1.9;
  }

  .m4-game-reference {
    margin: 14px 0 16px;
    padding: 10px 0 10px 11px;
    border-left: 1px solid rgba(21,21,29,0.3);
    color: rgba(21,21,29,0.56);
    font-family: "Noto Sans SC", sans-serif;
    font-size: 11px;
    line-height: 1.75;
  }

  .m4-game-options {
    display: grid;
    gap: 8px;
    margin-top: 10px;
  }

  .m4-game-option {
    position: relative;
    width: 100%;
    padding: 11px 34px 11px 12px;
    border: 1px solid rgba(21,21,29,0.14);
    color: rgba(21,21,29,0.72);
    background: rgba(21,21,29,0.025);
    cursor: pointer;
    text-align: left;
    transition: border-color 180ms ease, background-color 180ms ease, color 180ms ease;
  }

  .m4-game-option:hover,
  .m4-game-option:focus-visible {
    border-color: rgba(80,70,229,0.56);
    color: #15151d;
    background: rgba(80,70,229,0.065);
    outline: none;
  }

  .m4-game-option:disabled {
    cursor: wait;
    opacity: 0.46;
  }

  .m4-game-option strong {
    display: block;
    margin-bottom: 5px;
    font-family: "Noto Sans SC", sans-serif;
    font-size: 12px;
    font-weight: 500;
    line-height: 1.5;
  }

  .m4-game-option small {
    display: block;
    color: rgba(21,21,29,0.46);
    font-family: "Lexend", "Noto Sans SC", sans-serif;
    font-size: 9px;
    letter-spacing: 0.04em;
    line-height: 1.55;
  }

  .m4-game-option-index {
    position: absolute;
    top: 11px;
    right: 12px;
    color: rgba(21,21,29,0.38);
    font-family: "Lexend", sans-serif;
    font-size: 10px;
  }

  .m4-feedback-note {
    margin: 12px 0 16px;
    padding-left: 12px;
    border-left: 2px solid var(--feedback-color);
  }

  .m4-feedback-deltas {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
    margin: 16px 0 4px;
  }

  .m4-feedback-delta {
    padding: 3px 7px;
    border: 1px solid rgba(21,21,29,0.15);
    color: rgba(21,21,29,0.62);
    font-family: "Lexend", sans-serif;
    font-size: 9px;
    letter-spacing: 0.08em;
  }

  .m4-game-continue {
    width: 100%;
    margin-top: 17px;
    padding: 10px 12px;
    border: 1px solid rgba(21,21,29,0.82);
    color: #f8f7f4;
    background: #15151d;
    cursor: pointer;
    font-family: "Lexend", sans-serif;
    font-size: 9px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    transition: opacity 180ms ease;
  }

  .m4-game-continue:hover {
    opacity: 0.78;
  }

  .m4-story-panel {
    position: absolute;
    bottom: clamp(38px, 7vh, 72px);
    left: clamp(28px, 4vw, 72px);
    z-index: 4;
    width: min(470px, 42vw);
    color: #f4f4ff;
    pointer-events: none;
  }

  .m4-story-panel::before {
    display: block;
    width: 46px;
    height: 1px;
    margin-bottom: 15px;
    background: rgba(244,244,255,0.88);
    content: "";
  }

  .m4-story-panel p {
    margin: 9px 0 0;
    color: rgba(232,232,248,0.86);
    font-family: "Noto Serif SC", serif;
    font-size: 15px;
    line-height: 1.95;
  }

  .m4-mission-progress {
    margin-top: 15px;
  }

  .m4-mission-progress-track {
    height: 2px;
    margin-top: 7px;
    background: rgba(232,232,248,0.15);
  }

  .m4-mission-progress-value {
    height: 100%;
    background: rgba(244,244,255,0.86);
    transition: width 500ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  @media (max-width: 960px) {
    .m4-game-panel {
      right: 14px;
      width: min(340px, 38vw);
    }

    .m4-story-panel {
      width: min(390px, 44vw);
    }
  }

  @media (max-width: 720px) {
    .m4-game-panel {
      top: auto;
      right: 18px;
      bottom: 18px;
      left: 18px;
      width: auto;
      max-height: 58vh;
      transform: none;
    }

    .m4-story-panel {
      top: 26px;
      bottom: auto;
      left: 22px;
      width: calc(100vw - 44px);
    }
  }
`

useGLTF.preload(EARTH_GLB)
useGLTF.preload(SATELLITE_GLB)

function StartGuide({ opacity, progress }) {
  const guideOpacity = opacity * Math.max(0, 1 - progress * 2.8)

  return (
    <>
      <style>{GUIDE_STYLES}</style>

      <aside
        className="m4-start-guide m4-start-guide-left"
        aria-label="任务编号"
        style={{ opacity: guideOpacity }}
      >
        <p className="m4-guide-eyebrow">ORBITAL SURVIVAL / SIMULATION 04</p>
        <div className="m4-guide-number">
          <strong>01</strong>
          <span>初始轨道</span>
        </div>
        <div className="m4-guide-rule" />
        <p className="m4-guide-kicker">LOW EARTH ORBIT · DEBRIS RESPONSE</p>
      </aside>

      <aside
        className="m4-start-guide m4-start-guide-right"
        aria-label="游戏介绍"
        style={{ opacity: guideOpacity }}
      >
        <div className="m4-guide-icon" aria-hidden="true">
          <svg width="38" height="20" viewBox="0 0 38 20" fill="none">
            <ellipse cx="19" cy="10" rx="16" ry="6.5" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="19" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="33" cy="7" r="1.8" fill="currentColor" />
          </svg>
        </div>
        <h2>在碎片风暴中生存</h2>
        <p>接管一颗受损卫星，在十二个月的近地轨道任务中躲避碎片。每一次判断都会消耗燃料或护甲，也会改变最终结局。</p>
        <div className="m4-guide-action">12 MONTHS · ONE SATELLITE</div>
      </aside>
    </>
  )
}

function GameStatusHud({ month, fuel, armor, missionProgress }) {
  return (
    <section
      aria-label="卫星生存任务状态"
      style={{
        position: 'absolute',
        top: 'clamp(36px, 6vh, 72px)',
        left: 'clamp(28px, 4vw, 72px)',
        zIndex: 3,
        width: 'min(310px, calc(100vw - 56px))',
        padding: '4px 0 4px 18px',
        borderLeft: '1px solid rgba(232,232,248,0.42)',
        color: '#f4f4ff',
        pointerEvents: 'none',
      }}
    >
      <div style={{
        fontFamily: 'Space Mono, monospace',
        fontSize: 9,
        letterSpacing: '0.2em',
        color: 'rgba(232,232,248,0.48)',
        marginBottom: 16,
      }}>
        ORBITAL SURVIVAL · MISSION STATUS
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <strong style={{
          fontFamily: 'Space Mono, monospace',
          fontSize: 54,
          lineHeight: 0.92,
          fontWeight: 400,
          letterSpacing: '-0.1em',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {String(month).padStart(2, '0')}
        </strong>
        <span style={{
          fontFamily: '"Noto Sans SC", sans-serif',
          fontSize: 15,
          letterSpacing: '0.12em',
          color: 'rgba(232,232,248,0.76)',
        }}>
          月
        </span>
      </div>

      <div style={{
        height: 1,
        background: 'rgba(232,232,248,0.28)',
        margin: '17px 0 14px',
      }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <StatusMetric label="燃料" english="FUEL" value={fuel} />
        <StatusMetric label="护甲" english="ARMOR" value={armor} />
      </div>

      <div className="m4-mission-progress">
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          color: 'rgba(232,232,248,0.58)',
          fontFamily: 'Space Mono, monospace',
          fontSize: 8,
          letterSpacing: '0.14em',
        }}>
          <span>MISSION PROGRESS</span>
          <span>{Math.round(missionProgress)}%</span>
        </div>
        <div className="m4-mission-progress-track">
          <div
            className="m4-mission-progress-value"
            style={{ width: `${Math.max(0, Math.min(100, missionProgress))}%` }}
          />
        </div>
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: 13,
        color: 'rgba(232,232,248,0.48)',
        fontFamily: 'Space Mono, monospace',
        fontSize: 8,
        letterSpacing: '0.14em',
      }}>
        <span>ORBITAL DEBRIS</span>
        <span>20,000+</span>
      </div>
    </section>
  )
}

function StatusMetric({ label, english, value }) {
  const clamped = Math.max(0, Math.min(100, value))

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 8,
        marginBottom: 7,
      }}>
        <span style={{
          fontFamily: '"Noto Sans SC", sans-serif',
          fontSize: 12,
          color: 'rgba(232,232,248,0.74)',
        }}>
          {label}
        </span>
        <strong style={{
          fontFamily: 'Space Mono, monospace',
          fontSize: 15,
          fontWeight: 400,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {Math.round(clamped)}
          <small style={{ fontSize: 9, marginLeft: 2, color: 'rgba(232,232,248,0.58)' }}>%</small>
        </strong>
      </div>

      <div style={{ height: 2, background: 'rgba(232,232,248,0.16)' }}>
        <div style={{
          width: `${clamped}%`,
          height: '100%',
          background: 'rgba(244,244,255,0.88)',
          transition: 'width 500ms cubic-bezier(0.16, 1, 0.3, 1)',
        }} />
      </div>

      <div style={{
        marginTop: 6,
        fontFamily: 'Space Mono, monospace',
        fontSize: 8,
        letterSpacing: '0.14em',
        color: 'rgba(232,232,248,0.34)',
      }}>
        {english}
      </div>
    </div>
  )
}

function StoryPanel({ month, story }) {
  return (
    <MotionAside
      key={`${month}-${story}`}
      className="m4-story-panel"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      aria-live="polite"
    >
      <div className="m4-game-label">PARALLEL TIMELINE · MONTH {String(month).padStart(2, '0')}</div>
      <p>{story}</p>
    </MotionAside>
  )
}

function GamePanel({
  phase,
  event,
  round,
  loading,
  feedback,
  onChoose,
  onContinue,
}) {
  return (
    <aside className="m4-game-panel" aria-live="polite">
      <style>{GAME_STYLES}</style>
      <div className="m4-game-panel-header">
        <span className="m4-game-label">ORBITAL EVENT / {String(round + 1).padStart(2, '0')}</span>
        <span className="m4-game-label">{round + 1} / {TOTAL_ROUNDS}</span>
      </div>

      <AnimatePresence mode="wait">
        {loading && (
          <MotionDiv
            key="loading"
            className="m4-game-panel-body"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="m4-game-label">GROUND CONTROL · ANALYZING</div>
            <h2>正在回传任务日志</h2>
            <p>地面站正在比对轨道参数与历史案例。</p>
          </MotionDiv>
        )}

        {!loading && phase === GAME_PHASE.EVENT && event && (
          <MotionDiv
            key={`event-${event.id}`}
            className="m4-game-panel-body"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="m4-game-label">{THREAT_LABELS[event.type] || 'ORBITAL THREAT'} · THREAT DETECTED</div>
            <h2>{event.title}</h2>
            <p>{event.description}</p>
            <div className="m4-game-reference">{event.realRef}</div>
            <div className="m4-game-label">SELECT RESPONSE</div>
            <div className="m4-game-options">
              {event.options.map((option, index) => (
                <button
                  className="m4-game-option"
                  disabled={loading}
                  key={option.id}
                  onClick={() => onChoose(option)}
                >
                  <strong>{option.label}</strong>
                  <small>{option.subtext}</small>
                  <span className="m4-game-option-index">{String.fromCharCode(65 + index)}</span>
                </button>
              ))}
            </div>
          </MotionDiv>
        )}

        {!loading && phase === GAME_PHASE.FEEDBACK && feedback && (
          <MotionDiv
            key={`feedback-${round}`}
            className="m4-game-panel-body"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="m4-game-label">MISSION LOG · RESPONSE RECORDED</div>
            <h2>{feedback.title}</h2>
            <div className="m4-feedback-note" style={{ '--feedback-color': feedback.color }}>
              <p>{feedback.aiLog || feedback.techNote}</p>
            </div>
            <div className="m4-game-reference">{feedback.techNote}</div>
            <div className="m4-feedback-deltas">
              <DeltaTag label="ARMOR" value={feedback.armorDelta} />
              <DeltaTag label="FUEL" value={feedback.fuelDelta} />
              <DeltaTag label="MISSION" value={feedback.missionDelta} />
            </div>
            <button className="m4-game-continue" onClick={onContinue}>
              {round + 1 >= TOTAL_ROUNDS ? 'VIEW MISSION RESULT' : 'CONTINUE TO NEXT MONTH'}
            </button>
          </MotionDiv>
        )}
      </AnimatePresence>
    </aside>
  )
}

function DeltaTag({ label, value }) {
  if (!value) return null

  return (
    <span className="m4-feedback-delta">
      {label} {value > 0 ? '+' : ''}{value}%
    </span>
  )
}

function OrbitBackdrop({ opacity }) {
  return (
    <svg
      viewBox={`0 0 ${ORBIT_VIEWBOX_SIZE} ${ORBIT_VIEWBOX_SIZE}`}
      preserveAspectRatio="none"
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',
      }}
    >
      <ellipse
        cx={ORBIT_CENTER_X}
        cy={ORBIT_CENTER_Y}
        rx={ORBIT_RADIUS_X}
        ry={ORBIT_RADIUS_Y}
        fill="none"
        stroke={`rgba(255,255,255,${opacity})`}
        strokeWidth="2"
        strokeDasharray="3 16"
        strokeLinecap="round"
      />
    </svg>
  )
}

function OrbitControl({ progress, disabled, onProgressChange, onDragEnd }) {
  const controlRef = useRef()
  const activePointerRef = useRef(null)
  const angle = Math.PI - progress * Math.PI
  const knobX = ORBIT_CENTER_X + Math.cos(angle) * ORBIT_RADIUS_X
  const knobY = ORBIT_CENTER_Y + Math.sin(angle) * ORBIT_RADIUS_Y
  const showHint = progress < 0.08 && !disabled

  const updateProgress = useCallback((clientX) => {
    const rect = controlRef.current?.getBoundingClientRect()
    if (!rect) return

    const viewBoxX = ((clientX - rect.left) / rect.width) * ORBIT_VIEWBOX_SIZE
    const nextProgress = (viewBoxX - ORBIT_LEFT_X) / (ORBIT_RIGHT_X - ORBIT_LEFT_X)
    onProgressChange(Math.max(0, Math.min(1, nextProgress)))
  }, [onProgressChange])

  const handlePointerDown = useCallback((event) => {
    if (disabled || activePointerRef.current !== null) return
    activePointerRef.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)
    updateProgress(event.clientX)
  }, [disabled, updateProgress])

  const handlePointerMove = useCallback((event) => {
    if (
      activePointerRef.current === event.pointerId
      && event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      updateProgress(event.clientX)
    }
  }, [updateProgress])

  const handlePointerUp = useCallback((event) => {
    if (activePointerRef.current !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    activePointerRef.current = null
    onDragEnd()
  }, [onDragEnd])

  const handleKeyDown = useCallback((event) => {
    if (disabled) return

    let nextProgress = progress
    if (event.key === 'ArrowRight') nextProgress = Math.min(1, progress + 0.05)
    if (event.key === 'ArrowLeft') nextProgress = Math.max(0, progress - 0.05)
    if (event.key === 'Home') nextProgress = 0
    if (event.key === 'End') nextProgress = 1
    if (nextProgress === progress) return

    event.preventDefault()
    onProgressChange(nextProgress)
    if (nextProgress >= 0.98) onDragEnd()
  }, [disabled, onDragEnd, onProgressChange, progress])

  return (
    <div
      ref={controlRef}
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',
      }}
    >
      <svg
        viewBox={`0 0 ${ORBIT_VIEWBOX_SIZE} ${ORBIT_VIEWBOX_SIZE}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: '100%' }}
      >
        <path
          d={ORBIT_FRONT_PATH}
          fill="none"
          stroke="rgba(255,255,255,0.96)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>

      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label="向右拖动轨道节点开始任务"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        style={{
          position: 'absolute',
          left: `${knobX / ORBIT_VIEWBOX_SIZE * 100}%`,
          top: `${knobY / ORBIT_VIEWBOX_SIZE * 100}%`,
          display: 'grid',
          width: 54,
          height: 54,
          boxSizing: 'border-box',
          placeItems: 'center',
          borderRadius: '50%',
          background: '#ffffff',
          border: '4px solid rgba(222,228,255,0.96)',
          transform: 'translate(-50%, -50%)',
          cursor: 'grab',
          pointerEvents: disabled ? 'none' : 'auto',
          touchAction: 'none',
        }}
      >
        {showHint && <div className="m4-orbit-handle-halo" />}
        <svg className="m4-orbit-handle-arrow" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M3 9H14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M10 5L14 9L10 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {!disabled && (
        <div className="m4-orbit-static-hint">
          <span>按住节点向右拖动</span>
          <small>DRAG TO START</small>
        </div>
      )}
    </div>
  )
}

function toPersonalOrbitRadius(altitudeKm, earthRadius) {
  const parsedAltitude = Number(altitudeKm)
  const altitude = Number.isFinite(parsedAltitude) ? parsedAltitude : 836
  const clampedAltitude = Math.max(200, Math.min(35786, altitude))
  const normalizedAltitude = Math.log1p(clampedAltitude - 160) / Math.log1p(35786 - 160)
  return earthRadius + 0.032 + normalizedAltitude * 0.006
}

function OrbitSatelliteModel({ spinRef }) {
  const { scene } = useGLTF(SATELLITE_GLB)
  const normalizedScene = useMemo(() => {
    const clone = scene.clone(true)
    const bounds = new THREE.Box3().setFromObject(clone)
    const center = bounds.getCenter(new THREE.Vector3())
    const size = bounds.getSize(new THREE.Vector3())
    const maxSize = Math.max(size.x, size.y, size.z) || 1
    const modelScale = PERSONAL_SATELLITE_SIZE / maxSize

    clone.position.copy(center).multiplyScalar(-modelScale)
    clone.scale.setScalar(modelScale)
    return clone
  }, [scene])

  return (
    <group ref={spinRef} rotation={[0.2, 0.45, -0.16]}>
      <primitive object={normalizedScene} />
    </group>
  )
}

function PersonalSatelliteOrbit({ altitudeKm, inclinationDeg, earthRadius }) {
  const satelliteRef = useRef()
  const spinRef = useRef()
  const phaseRef = useRef(Math.PI * 0.04)
  const reduceMotionRef = useRef(false)
  const radius = toPersonalOrbitRadius(altitudeKm, earthRadius)
  const parsedInclination = Number(inclinationDeg)
  const inclination = THREE.MathUtils.degToRad(
    Number.isFinite(parsedInclination) ? parsedInclination : 98.7,
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => {
      reduceMotionRef.current = media.matches
    }

    updatePreference()
    media.addEventListener('change', updatePreference)
    return () => media.removeEventListener('change', updatePreference)
  }, [])

  useFrame((_, delta) => {
    const canAnimate = !reduceMotionRef.current
      && (typeof document === 'undefined' || document.visibilityState === 'visible')

    if (canAnimate) {
      phaseRef.current = (phaseRef.current + delta * PERSONAL_ORBIT_SPEED) % (Math.PI * 2)
      if (spinRef.current) spinRef.current.rotation.y += delta * 0.18
    }

    if (!satelliteRef.current) return
    satelliteRef.current.position.set(
      Math.cos(phaseRef.current) * radius,
      Math.sin(phaseRef.current) * radius,
      0,
    )
  })

  return (
    <group rotation={[inclination - Math.PI / 2, 0.38, -0.14]}>
      <mesh>
        <torusGeometry args={[radius, 0.0016, 5, 240]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.96} depthWrite={false} />
      </mesh>

      <group ref={satelliteRef}>
        <mesh>
          <sphereGeometry args={[0.008, 12, 12]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <pointLight color="#ffffff" intensity={0.36} distance={0.7} />
        <OrbitSatelliteModel spinRef={spinRef} />
      </group>
    </group>
  )
}

function createSeededRandom(seed) {
  let value = seed >>> 0

  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 4294967296
  }
}

function buildOrbitalDebrisData(count, earthRadius) {
  const random = createSeededRandom(0x51a7e)

  return Array.from({ length: count }, () => {
    const innerBand = random() < 0.78
    const altitude = innerBand
      ? 0.035 + random() * 0.085
      : 0.12 + random() * 0.13
    const length = 0.0024 + random() * 0.0056
    const thickness = 0.0012 + random() * 0.002

    return {
      radius: earthRadius + altitude,
      theta: random() * Math.PI * 2,
      inclination: 0.16 + random() * Math.PI * 0.78,
      ascendingNode: random() * Math.PI * 2,
      speed: (0.016 + random() * 0.032) * (random() > 0.14 ? 1 : -1),
      scale: [length, thickness, thickness * (0.7 + random() * 0.9)],
      rotation: [random() * Math.PI, random() * Math.PI, random() * Math.PI],
      spin: [(random() - 0.5) * 0.18, (random() - 0.5) * 0.18, (random() - 0.5) * 0.18],
      offset: new THREE.Vector3(),
    }
  })
}

function OrbitalDebrisCloud({ earthRadius, damageLevel }) {
  const meshRef = useRef()
  const reduceMotionRef = useRef(false)
  const pointerActiveRef = useRef(false)
  const pointerNdcRef = useRef(new THREE.Vector2(2, 2))
  const { gl } = useThree()
  const parsedDamageLevel = Number(damageLevel)
  const actualCount = Math.min(
    ORBITAL_DEBRIS_BASE_COUNT + (
      Number.isFinite(parsedDamageLevel) ? Math.max(0, Math.round(parsedDamageLevel * 80)) : 0
    ),
    ORBITAL_DEBRIS_MAX_COUNT,
  )
  const debrisData = useMemo(
    () => buildOrbitalDebrisData(actualCount, earthRadius),
    [actualCount, earthRadius],
  )
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const vectors = useMemo(() => ({
    basePosition: new THREE.Vector3(),
    projectedPosition: new THREE.Vector3(),
    cameraRight: new THREE.Vector3(),
    cameraUp: new THREE.Vector3(),
    localDirection: new THREE.Vector3(),
    targetOffset: new THREE.Vector3(),
    inverseWorldMatrix: new THREE.Matrix4(),
  }), [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => {
      reduceMotionRef.current = media.matches
    }

    updatePreference()
    media.addEventListener('change', updatePreference)
    return () => media.removeEventListener('change', updatePreference)
  }, [])

  useEffect(() => {
    meshRef.current?.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  }, [])

  useEffect(() => {
    const canvas = gl.domElement

    const handlePointerMove = (event) => {
      const rect = canvas.getBoundingClientRect()
      pointerNdcRef.current.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      )
      pointerActiveRef.current = true
    }
    const handlePointerLeave = () => {
      pointerActiveRef.current = false
    }

    canvas.addEventListener('pointermove', handlePointerMove, { passive: true })
    canvas.addEventListener('pointerleave', handlePointerLeave)
    return () => {
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerleave', handlePointerLeave)
    }
  }, [gl])

  useFrame((state, delta) => {
    if (!meshRef.current) return

    const canAnimate = !reduceMotionRef.current
      && (typeof document === 'undefined' || document.visibilityState === 'visible')
    const canInteract = canAnimate && pointerActiveRef.current
    const influenceRadius = 0.5

    vectors.inverseWorldMatrix.copy(meshRef.current.matrixWorld).invert()
    vectors.cameraRight
      .setFromMatrixColumn(state.camera.matrixWorld, 0)
      .transformDirection(vectors.inverseWorldMatrix)
    vectors.cameraUp
      .setFromMatrixColumn(state.camera.matrixWorld, 1)
      .transformDirection(vectors.inverseWorldMatrix)

    debrisData.forEach((debris, index) => {
      if (canAnimate) {
        debris.theta = (debris.theta + delta * debris.speed) % (Math.PI * 2)
        debris.rotation[0] += delta * debris.spin[0]
        debris.rotation[1] += delta * debris.spin[1]
        debris.rotation[2] += delta * debris.spin[2]
      }

      const cosTheta = Math.cos(debris.theta)
      const sinTheta = Math.sin(debris.theta)
      const cosNode = Math.cos(debris.ascendingNode)
      const sinNode = Math.sin(debris.ascendingNode)
      const cosInclination = Math.cos(debris.inclination)
      const sinInclination = Math.sin(debris.inclination)

      vectors.basePosition.set(
        debris.radius * (cosNode * cosTheta - sinNode * sinTheta * cosInclination),
        debris.radius * sinTheta * sinInclination,
        debris.radius * (sinNode * cosTheta + cosNode * sinTheta * cosInclination),
      )

      vectors.targetOffset.set(0, 0, 0)
      if (canInteract) {
        vectors.projectedPosition
          .copy(vectors.basePosition)
          .applyMatrix4(meshRef.current.matrixWorld)
          .project(state.camera)

        const dx = vectors.projectedPosition.x - pointerNdcRef.current.x
        const dy = vectors.projectedPosition.y - pointerNdcRef.current.y
        const distance = Math.hypot(dx, dy)

        if (
          vectors.projectedPosition.z >= -1
          && vectors.projectedPosition.z <= 1
          && distance < influenceRadius
        ) {
          const normalizedDistance = Math.max(distance, 0.0001)
          const strength = Math.pow(1 - distance / influenceRadius, 2.4) * 0.038

          vectors.localDirection
            .copy(vectors.cameraRight)
            .multiplyScalar(dx / normalizedDistance)
            .addScaledVector(vectors.cameraUp, dy / normalizedDistance)
            .normalize()
          vectors.targetOffset.copy(vectors.localDirection).multiplyScalar(strength)
        }
      }

      const responseSpeed = vectors.targetOffset.lengthSq() > 0 ? 5.5 : 2.4
      debris.offset.lerp(vectors.targetOffset, 1 - Math.exp(-delta * responseSpeed))
      dummy.position.copy(vectors.basePosition).add(debris.offset)
      dummy.rotation.set(...debris.rotation)
      dummy.scale.set(...debris.scale)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(index, dummy.matrix)
    })

    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[null, null, actualCount]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#e7e5ee" transparent opacity={0.72} depthWrite={false} />
    </instancedMesh>
  )
}

function EarthScene({ proxy, satellite, damageLevel, showPersonalOrbit }) {
  const { scene } = useGLTF(EARTH_GLB)
  const groupRef = useRef()
  const earthRef = useRef()
  const earthMetrics = useMemo(() => {
    const bounds = new THREE.Box3().setFromObject(scene)
    const center = bounds.getCenter(new THREE.Vector3())
    const size = bounds.getSize(new THREE.Vector3())

    return {
      centerOffset: center.multiplyScalar(-EARTH_SCALE),
      radius: Math.max(size.x, size.y, size.z) * EARTH_SCALE * 0.5,
    }
  }, [scene])

  useFrame((_, dt) => {
    if (!groupRef.current) return
    groupRef.current.scale.setScalar(proxy.current.scale)
    groupRef.current.position.x = proxy.current.x
    if (earthRef.current) earthRef.current.rotation.y += dt * 0.055
  })

  return (
    <group ref={groupRef}>
      <group ref={earthRef}>
        <primitive
          object={scene}
          position={earthMetrics.centerOffset}
          scale={EARTH_SCALE}
        />
        {showPersonalOrbit && (
          <PersonalSatelliteOrbit
            altitudeKm={satellite?.altitudeKm}
            inclinationDeg={satellite?.inclination}
            earthRadius={earthMetrics.radius}
          />
        )}
      </group>
      {showPersonalOrbit && (
        <OrbitalDebrisCloud
          earthRadius={earthMetrics.radius}
          damageLevel={damageLevel}
        />
      )}
    </group>
  )
}

export default function M4New({ onComplete = () => {} }) {
  const {
    satellite,
    user,
    materials,
    damageLevel,
    clickedHistoryEvents,
    storyOutline,
    storyChapters,
    setGameResult,
    setDebrisGenerated,
    setScrollLocked,
    setStoryChapter,
  } = useAppStore()
  const proxy = useRef({ scale: MIN_EARTH_SCALE, orbitOpacity: 1, x: 0 })
  const started = useRef(false)
  const progressRef = useRef(0)
  const [events] = useState(() => pickEvents(damageLevel, clickedHistoryEvents || [], TOTAL_ROUNDS))
  const [gameStatus, setGameStatus] = useState(() => ({
    fuel: 100,
    armor: calcInitialArmor(damageLevel),
    missionProgress: 0,
  }))
  const [orbitProgress, setOrbitProgress] = useState(0)
  const [orbitOpacity, setOrbitOpacity] = useState(1)
  const [orbitLocked, setOrbitLocked] = useState(false)
  const [orbitVisible, setOrbitVisible] = useState(true)
  const [gameStarted, setGameStarted] = useState(false)
  const [phase, setPhase] = useState(GAME_PHASE.EVENT)
  const [round, setRound] = useState(0)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [decisions, setDecisions] = useState([])
  const [reflection, setReflection] = useState(null)
  const [localResult, setLocalResult] = useState(null)
  const initialStory = storyChapters?.m3
    || storyChapters?.opening
    || `${satellite?.name || '卫星'}进入近地轨道。监测系统开始记录每一次微小偏移。`
  const [storyThread, setStoryThread] = useState([initialStory])
  const currentEvent = events[round] || null
  const currentMonth = GAME_MONTHS[round] || GAME_MONTHS[GAME_MONTHS.length - 1]
  const latestStory = storyThread[storyThread.length - 1]

  useEffect(() => {
    if (!gameStarted || phase === GAME_PHASE.REFLECTION) {
      setScrollLocked(false)
      return
    }

    setScrollLocked(true)
    return () => setScrollLocked(false)
  }, [gameStarted, phase, setScrollLocked])

  const handleGameEnd = useCallback(async (allDecisions, finalStatus, finalStories) => {
    const result = evaluateResult({
      armor: finalStatus.armor,
      fuel: finalStatus.fuel,
      missionProgress: finalStatus.missionProgress,
      totalRounds: TOTAL_ROUNDS,
    })
    const isSuccess = result === 'success'
    const material = materials?.frame || '铝合金'
    const finalStory = finalStories[finalStories.length - 1]

    setLoading(true)
    let generatedReflection
    try {
      generatedReflection = await generateGameReflection({
        gameResult: isSuccess ? 'success' : 'failure',
        decisions: allDecisions,
        satellite: satellite || { name: 'UNKNOWN' },
        user: user || { name: '用户', importantEvent: '某件重要的事' },
        material,
        storyOutline,
      })
    } catch {
      generatedReflection = {
        knowledgePoints: [
          '每一次轨道规避都会消耗有限燃料。',
          '小尺寸碎片仍可能造成不可逆损伤。',
          '失控卫星会继续增加近地轨道风险。',
        ],
        satFate: isSuccess
          ? '卫星完成任务并保留了离轨能力。'
          : '卫星失去控制，成为新的轨道碎片来源。',
        debrisDescription: `${material}碎片，来源于受损卫星，残留于近地轨道。`,
      }
    }

    const normalizedReflection = {
      ...generatedReflection,
      storyEnding: generatedReflection.storyEnding
        || finalStory
        || (isSuccess ? '那件重要的事仍按原来的方向推进。' : '那件重要的事出现了无法忽略的偏移。'),
    }

    setGameResult({
      result,
      finalArmor: finalStatus.armor,
      finalFuel: finalStatus.fuel,
      finalMission: finalStatus.missionProgress,
      decisionCount: allDecisions.length,
    })
    setDebrisGenerated([normalizedReflection.debrisDescription])
    setStoryChapter('m4', normalizedReflection.storyEnding)
    setLocalResult(result)
    setReflection(normalizedReflection)
    setLoading(false)
    setPhase(GAME_PHASE.REFLECTION)
  }, [
    materials,
    satellite,
    setDebrisGenerated,
    setGameResult,
    setStoryChapter,
    storyOutline,
    user,
  ])

  const handleChoose = useCallback(async (option) => {
    if (!currentEvent || loading) return

    const nextStatus = {
      armor: Math.max(0, Math.min(100, gameStatus.armor + (option.armorDelta || 0))),
      fuel: Math.max(0, Math.min(100, gameStatus.fuel + (option.fuelDelta || 0))),
      missionProgress: Math.max(0, Math.min(100, gameStatus.missionProgress + (option.missionDelta || 0))),
    }
    const decision = {
      round,
      eventId: currentEvent.id,
      eventTitle: currentEvent.title,
      optionId: option.id,
      optionLabel: option.label,
      outcome: option.outcome,
      armorDelta: option.armorDelta,
      fuelDelta: option.fuelDelta,
      missionDelta: option.missionDelta,
    }

    setLoading(true)
    let aiResult
    try {
      aiResult = await generateGameDecisionFeedback({
        decision: option.label,
        threat: currentEvent.title,
        outcome: option.outcome,
        satellite: satellite || { name: 'UNKNOWN' },
        user: user || { name: '用户', importantEvent: '某件重要的事' },
        storyOutline,
        decisionIndex: round,
        totalDecisions: TOTAL_ROUNDS,
      })
    } catch {
      aiResult = {
        feedback: option.techNote,
        storyUpdate: option.outcome === 'correct'
          ? `${satellite?.name || '卫星'}完成机动，轨道数据重新稳定。平行时空中的关键节点暂时没有偏离。`
          : `${satellite?.name || '卫星'}的遥测信号出现新的波动。平行时空中的一个细节随之改变。`,
      }
    }

    const nextStories = aiResult.storyUpdate
      ? [...storyThread, aiResult.storyUpdate]
      : storyThread
    const nextDecisions = [...decisions, decision]
    const feedbackColor = option.outcome === 'correct'
      ? '#16835d'
      : option.outcome === 'partial'
        ? '#b66b16'
        : '#b13b32'

    setGameStatus(nextStatus)
    setDecisions(nextDecisions)
    setStoryThread(nextStories)
    setFeedback({
      ...option,
      title: option.outcome === 'correct'
        ? '机动执行完成'
        : option.outcome === 'partial'
          ? '风险仍未完全解除'
          : '轨道状态继续恶化',
      aiLog: aiResult.feedback || option.techNote,
      color: feedbackColor,
      nextDecisions,
      nextStories,
      nextStatus,
    })
    setLoading(false)
    setPhase(GAME_PHASE.FEEDBACK)
  }, [
    currentEvent,
    decisions,
    gameStatus,
    loading,
    round,
    satellite,
    storyOutline,
    storyThread,
    user,
  ])

  const handleContinue = useCallback(async () => {
    if (!feedback) return

    const isFinished = round + 1 >= TOTAL_ROUNDS
      || feedback.nextStatus.armor <= 0
      || feedback.nextStatus.fuel <= 0

    if (isFinished) {
      await handleGameEnd(feedback.nextDecisions, feedback.nextStatus, feedback.nextStories)
      return
    }

    setRound((value) => value + 1)
    setFeedback(null)
    setPhase(GAME_PHASE.EVENT)
  }, [feedback, handleGameEnd, round])

  const handleProgressChange = useCallback((progress) => {
    progressRef.current = progress
    setOrbitProgress(progress)
  }, [])

  const handleDragEnd = useCallback(() => {
    if (progressRef.current < 0.98 || started.current) return
    started.current = true
    setOrbitLocked(true)
    handleProgressChange(1)
    gsap.to(proxy.current, {
      scale: EXPANDED_EARTH_SCALE,
      x: 0,
      orbitOpacity: 0,
      duration: 1.1,
      ease: 'power3.inOut',
      onUpdate() {
        setOrbitOpacity(proxy.current.orbitOpacity)
      },
      onComplete() {
        setOrbitVisible(false)
        setGameStarted(true)
      },
    })
  }, [handleProgressChange])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden' }}>
      {orbitVisible && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <OrbitBackdrop opacity={orbitOpacity * 0.9} />
        </div>
      )}

      <Canvas
        camera={{ position: [0, 1.4, 3.2], fov: 44 }}
        style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%' }}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={2.2} />
        <directionalLight position={[4, 3, 3]} intensity={4.0} color="#c8d8f0" />
        <directionalLight position={[-3, 1, -2]} intensity={1.2} color="#8899cc" />
        <pointLight position={[0, 4, 2]} intensity={2.5} color="#ffffff" />
        <Suspense fallback={null}>
          <EarthScene
            proxy={proxy}
            satellite={satellite}
            damageLevel={damageLevel}
            showPersonalOrbit={gameStarted}
          />
        </Suspense>
        <OrbitControls
          enableDamping
          dampingFactor={0.06}
          enablePan={false}
          enableZoom={false}
          rotateSpeed={0.45}
          minPolarAngle={Math.PI * 0.22}
          maxPolarAngle={Math.PI * 0.78}
        />
      </Canvas>

      {orbitVisible && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 2, opacity: orbitOpacity }}>
          <OrbitControl
            progress={orbitProgress}
            disabled={orbitLocked}
            onProgressChange={handleProgressChange}
            onDragEnd={handleDragEnd}
          />
        </div>
      )}

      {orbitVisible && <StartGuide opacity={orbitOpacity} progress={orbitProgress} />}

      {gameStarted && (
        <>
          <GameStatusHud
            month={currentMonth}
            fuel={gameStatus.fuel}
            armor={gameStatus.armor}
            missionProgress={gameStatus.missionProgress}
          />
          {phase !== GAME_PHASE.REFLECTION && (
            <>
              <StoryPanel month={currentMonth} story={latestStory} />
              <GamePanel
                phase={phase}
                event={currentEvent}
                round={round}
                loading={loading}
                feedback={feedback}
                onChoose={handleChoose}
                onContinue={handleContinue}
              />
            </>
          )}
          {phase === GAME_PHASE.REFLECTION && (
            <ReflectionPage
              reflection={reflection}
              gameResult={localResult}
              missionStats={gameStatus}
              onComplete={onComplete}
            />
          )}
        </>
      )}
    </div>
  )
}
