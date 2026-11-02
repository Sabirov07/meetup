import { common } from "./common";
import { nav } from "./nav";
import { shell } from "./shell";
import { enums } from "./enums";
import { dates } from "./dates";
import { auth } from "./auth";
import { overview } from "./overview";
import { tasks } from "./tasks";
import { intake } from "./intake";
import { meetings } from "./meetings";
import { review } from "./review";
import { activity } from "./activity";
import { settings } from "./settings";
import { doc } from "./doc";
import { errors } from "./errors";
import { knowledge } from "./knowledge";
import { team } from "./team";
import { spaces } from "./spaces";
import { discussion } from "./discussion";

/**
 * Every translatable string in the product, in one object.
 *
 * Sections exist for the benefit of whoever is reading; the keys are globally
 * unique and prefixed by area, so merging them is flat and collisions are a
 * duplicate-key error rather than a silent override.
 */
export const strings = {
  ...common,
  ...nav,
  ...shell,
  ...enums,
  ...dates,
  ...auth,
  ...overview,
  ...tasks,
  ...intake,
  ...meetings,
  ...review,
  ...activity,
  ...settings,
  ...doc,
  ...errors,
  ...knowledge,
  ...team,
  ...spaces,
  ...discussion,
} as const;
