import type { PluginConfig } from '../../types';
import { CheckboxCard } from '../controls/CheckboxCard';
import { TimeField } from '../controls/TimeField';
import { SectionHeader } from '../controls/SectionHeader';
import type { UpdateFieldHandler } from './types';

type TimeWindowSectionProps = {
  config: PluginConfig;
  onUpdateField: UpdateFieldHandler;
};

const sectionClass = 'grid gap-3 rounded-2xl border border-[#8ebebc]/25 bg-[linear-gradient(168deg,rgba(14,38,43,0.84),rgba(8,26,30,0.72))] p-4 shadow-[0_16px_34px_rgba(0,0,0,0.26)] motion-safe:animate-jc-rise';

export function TimeWindowSection(props: TimeWindowSectionProps) {
  const c = props.config;

  return (
    <section class={`${sectionClass} ${c.TimeWindowEnabled ? '' : 'opacity-70'}`}>
      <SectionHeader
        title="Active Time Window"
        description="Restrict enforcement to a specific time range. Useful for overnight or night-only schedules."
      />

      <CheckboxCard
        id="jc_tw_enabled"
        label="Enable time window"
        description="Only enforce during the configured hours. Outside this window, enforcement is paused."
        checked={c.TimeWindowEnabled}
        onChange={(checked) => props.onUpdateField('TimeWindowEnabled', checked)}
      />

      <div class={`grid gap-3 max-[920px]:grid-cols-1 md:grid-cols-2 ${c.TimeWindowEnabled ? '' : 'hidden'}`}>
        <TimeField
          id="jc_tw_start"
          label="Active from"
          value={c.TimeWindowStart}
          onInput={(ev) => props.onUpdateField('TimeWindowStart', ev.target.value)}
          help="Enforcement starts at this time (server local time)."
        />
        <TimeField
          id="jc_tw_end"
          label="Active until"
          value={c.TimeWindowEnd}
          onInput={(ev) => props.onUpdateField('TimeWindowEnd', ev.target.value)}
          help="Enforcement stops at this time. Overnight wrap-around is supported (e.g. 22:00 → 06:10)."
        />
      </div>
    </section>
  );
}
