import { html } from "./preact.mjs?v=ani-sync";
import { updateMemoryField } from "./memory.mjs?v=ani-sync";

export function RawTab({ logText }) {
  return html`<section><h2>Log</h2><div class="log">${logText}</div></section>`;
}

export function MemoryInput({ value, kind, addr, length = 1, updateBlocks }) {
  return html`<input value=${value} onChange=${(e) => updateBlocks((b) => updateMemoryField(b, kind, addr, e.target.value, length))} />`;
}

export function Input({ label, value, onInput, type = "text" }) {
  return html`<label>${label}<input type=${type} value=${value} onInput=${onInput} /></label>`;
}

export function Select({ value, labels, onChange }) {
  return html`<select defaultValue=${value} onChange=${(e) => onChange(e.target.value)}>${labels.map((label, index) => html`<option value=${index}>${label}</option>`)}</select>`;
}

export function ValueSelect({ value, options, onChange, displayValue = value }) {
  return html`<select value=${displayValue} onChange=${(e) => onChange(e.target.value)}>
    ${options.some(([optionValue]) => optionValue === displayValue) ? null : html`<option value=${displayValue}>Raw ${value}</option>`}
    ${options.map(([optionValue, label]) => html`<option value=${optionValue}>${label}</option>`)}
  </select>`;
}
