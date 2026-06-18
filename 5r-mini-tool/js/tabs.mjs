import { html } from "./preact.mjs?v=ani-sync";

export function Tabs({ tab, setTab }) {
  const mainTabs = [["channels", "Channels"], ["vfo", "VFO"], ["settings", "Settings"], ["contacts", "DTMF / Offline"], ["bootLogo", "Boot Logo"], ["raw", "Raw / Log"]];
  const wizardTabs = [["pmr", "PMR446"], ["batch", "Batch"], ["calling", "DTMF Calling"]];
  return html`<div class="tabs" role="tablist">${mainTabs.map(([key, label]) => html`<button class=${`tab-button ${tab === key ? "active" : ""}`} type="button" onClick=${() => setTab(key)}>${label}</button>`)}<span class="tab-separator">Wizards</span>${wizardTabs.map(([key, label]) => html`<button class=${`tab-button wizard-tab ${tab === key ? "active" : ""}`} type="button" onClick=${() => setTab(key)}>${label}</button>`)}</div>`;
}
