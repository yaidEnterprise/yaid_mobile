import { Stage } from './domain/enums/stage';

function resolveStage(): Stage {
  const raw = process.env.EXPO_PUBLIC_STAGE;
  if (raw === Stage.Test || raw === Stage.Dev || raw === Stage.Homol || raw === Stage.Prod) {
    return raw;
  }
  throw new Error(
    `Invalid or missing EXPO_PUBLIC_STAGE: "${raw}". Expected one of: test, dev, homol, prod.`,
  );
}

export const environments = {
  stage: resolveStage(),
};
