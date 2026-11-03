import { h } from "./dom.js";

export const LOGO = "img/logo.svg";

export const logo = (size = 40) => h("img", { class: "logo", src: LOGO, alt: "Hospital logo", width: size, height: size });
