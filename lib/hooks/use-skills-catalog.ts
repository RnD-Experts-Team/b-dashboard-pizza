"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  handleUnauthorized,
  schedulingService,
} from "@/lib/api/services/scheduling.service";
import {
  parseSchedulingError,
  type SchedulingError,
} from "@/lib/scheduling/errors";
import type { Skill, SkillDraft } from "@/types/skills.types";

/**
 * The shared skills list. Anyone signed in reads it; the writes pass only for
 * the head (`manage skills` held globally). Writes throw a `SchedulingError`
 * so the dialog can show the server's own message (e.g. a duplicate name).
 */
export function useSkillsCatalog() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<SchedulingError | null>(null);
  const [revision, setRevision] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    const load = async () => {
      try {
        const result = await schedulingService.getSkills(controller.signal);
        if (!controller.signal.aborted) setSkills(result);
      } catch (err) {
        if (controller.signal.aborted || axios.isCancel(err)) return;
        const parsed = parseSchedulingError(err, "Could not load the skills list.");
        if (handleUnauthorized(parsed.status)) return;
        setError(parsed);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    void load();

    return () => controller.abort();
  }, [revision]);

  const refetch = useCallback(() => setRevision((r) => r + 1), []);

  const run = useCallback(async (action: () => Promise<unknown>, fallback: string) => {
    try {
      await action();
      setRevision((r) => r + 1);
    } catch (err) {
      const parsed = parseSchedulingError(err, fallback);
      handleUnauthorized(parsed.status);
      throw parsed;
    }
  }, []);

  const createSkill = useCallback(
    (draft: SkillDraft) => run(() => schedulingService.createSkill(draft), "Could not add the skill."),
    [run],
  );
  const updateSkill = useCallback(
    (skillId: string, draft: SkillDraft) =>
      run(() => schedulingService.updateSkill(skillId, draft), "Could not save the skill."),
    [run],
  );
  const deleteSkill = useCallback(
    (skillId: string) => run(() => schedulingService.deleteSkill(skillId), "Could not delete the skill."),
    [run],
  );

  return { skills, isLoading, error, refetch, createSkill, updateSkill, deleteSkill };
}
