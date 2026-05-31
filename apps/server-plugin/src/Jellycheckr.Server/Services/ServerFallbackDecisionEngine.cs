using Jellycheckr.Contracts;
using Jellycheckr.Server.Models;

namespace Jellycheckr.Server.Services;

public interface IServerFallbackDecisionEngine
{
    ServerFallbackDecision Evaluate(SessionState state, EffectiveConfigResponse config, DateTimeOffset nowUtc);
}

public sealed class ServerFallbackDecisionEngine : IServerFallbackDecisionEngine
{
    public ServerFallbackDecision Evaluate(SessionState state, EffectiveConfigResponse config, DateTimeOffset nowUtc)
    {
        if (!config.Enabled)
        {
            return ServerFallbackDecision.Skip("disabled");
        }

        if (!config.EnableServerFallback)
        {
            return ServerFallbackDecision.Skip("fallback_disabled");
        }

        if (state.FallbackPhase == ServerFallbackPhase.PauseGracePending)
        {
            return ServerFallbackDecision.Skip("pause_grace_pending");
        }

        if (state.NextEligiblePromptUtc > nowUtc)
        {
            return ServerFallbackDecision.Skip("cooldown");
        }

        if (string.IsNullOrWhiteSpace(state.CurrentItemId))
        {
            return ServerFallbackDecision.Skip("no_current_item");
        }

        if (state.IsPaused == true)
        {
            return ServerFallbackDecision.Skip("paused");
        }

        if (config.TimeWindowEnabled && !IsInTimeWindow(nowUtc, config.TimeWindowStart, config.TimeWindowEnd))
        {
            return ServerFallbackDecision.Skip("outside_time_window");
        }

        // Developer mode provides a fast-path trigger for native-client fallback testing.
        // This mirrors the web quick-cycle intent without requiring episode/time/inactivity thresholds.
        if (config.DeveloperMode && config.DeveloperPromptAfterSeconds > 0)
        {
            var developerPlaybackSeconds = TimeSpan.FromTicks(Math.Max(0, state.ServerFallbackPlaybackTicksSinceReset)).TotalSeconds;
            if (developerPlaybackSeconds >= config.DeveloperPromptAfterSeconds)
            {
                return new ServerFallbackDecision(
                    true,
                    $"developer_mode_after_{config.DeveloperPromptAfterSeconds}s",
                    developerPlaybackSeconds / 60d,
                    state.ServerFallbackEpisodeTransitionsSinceReset,
                    0);
            }
        }

        var episodeThresholdEnabled = config.EnableEpisodeCheck;
        var minutesThresholdEnabled = config.EnableTimerCheck;
        if (!episodeThresholdEnabled && !minutesThresholdEnabled)
        {
            return ServerFallbackDecision.Skip("thresholds_disabled");
        }

        var episodesReached = episodeThresholdEnabled
            && state.ServerFallbackEpisodeTransitionsSinceReset >= config.EpisodeThreshold;
        var minutesPlayed = TimeSpan.FromTicks(Math.Max(0, state.ServerFallbackPlaybackTicksSinceReset)).TotalMinutes;
        var minutesReached = minutesThresholdEnabled && minutesPlayed >= config.MinutesThreshold;

        var thresholdMet = (episodeThresholdEnabled && episodesReached) || (minutesThresholdEnabled && minutesReached);

        if (!thresholdMet)
        {
            return ServerFallbackDecision.Skip(
                "thresholds_not_met",
                minutesPlayed,
                state.ServerFallbackEpisodeTransitionsSinceReset,
                0);
        }

        var activityAnchor = ResolveActivityAnchor(state, nowUtc);
        var inactivityMinutes = Math.Max(0, (nowUtc - activityAnchor).TotalMinutes);
        if (inactivityMinutes < config.ServerFallbackInactivityMinutes)
        {
            return ServerFallbackDecision.Skip(
                "inactivity_not_met",
                minutesPlayed,
                state.ServerFallbackEpisodeTransitionsSinceReset,
                inactivityMinutes);
        }

        var reason = $"threshold=or inactivity={inactivityMinutes:F1}m";
        return new ServerFallbackDecision(true, reason, minutesPlayed, state.ServerFallbackEpisodeTransitionsSinceReset, inactivityMinutes);
    }

    private static bool IsInTimeWindow(DateTimeOffset nowUtc, string start, string end)
    {
        if (!TryParseTimeMinutes(start, out var startMins) || !TryParseTimeMinutes(end, out var endMins))
            return true;

        var local = nowUtc.ToLocalTime();
        var nowMins = local.Hour * 60 + local.Minute;

        // Overnight window (e.g. 22:00 → 06:10): wrap around midnight
        return startMins <= endMins
            ? nowMins >= startMins && nowMins < endMins
            : nowMins >= startMins || nowMins < endMins;
    }

    private static bool TryParseTimeMinutes(string time, out int minutes)
    {
        minutes = 0;
        if (string.IsNullOrWhiteSpace(time)) return false;
        var parts = time.Trim().Split(':');
        if (parts.Length != 2) return false;
        if (!int.TryParse(parts[0], out var h) || !int.TryParse(parts[1], out var m)) return false;
        if (h < 0 || h > 23 || m < 0 || m > 59) return false;
        minutes = h * 60 + m;
        return true;
    }

    private static DateTimeOffset ResolveActivityAnchor(SessionState state, DateTimeOffset nowUtc)
    {
        var lastInteractionUtc = state.LastInteractionUtc > DateTimeOffset.MinValue
            ? state.LastInteractionUtc
            : DateTimeOffset.MinValue;
        var lastInferredActivityUtc = state.LastInferredActivityUtc > DateTimeOffset.MinValue
            ? state.LastInferredActivityUtc
            : DateTimeOffset.MinValue;

        if (lastInteractionUtc > DateTimeOffset.MinValue || lastInferredActivityUtc > DateTimeOffset.MinValue)
        {
            return lastInteractionUtc >= lastInferredActivityUtc
                ? lastInteractionUtc
                : lastInferredActivityUtc;
        }

        return state.LastSeenUtc != DateTimeOffset.MinValue
            ? state.LastSeenUtc
            : nowUtc;
    }
}

public readonly record struct ServerFallbackDecision(
    bool ShouldTrigger,
    string Reason,
    double PlaybackMinutesSinceReset,
    int EpisodeTransitionsSinceReset,
    double InactivityMinutes)
{
    public static ServerFallbackDecision Skip(
        string reason,
        double playbackMinutesSinceReset = 0,
        int episodeTransitionsSinceReset = 0,
        double inactivityMinutes = 0)
        => new(false, reason, playbackMinutesSinceReset, episodeTransitionsSinceReset, inactivityMinutes);
}
