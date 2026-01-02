"use client";

import React, { useEffect, useRef, useState } from "react";

type ExtraId =
  | "REN" | "DU" | "CHONG" | "DAI"
  | "YINWEI" | "YANGWEI" | "YINQIAO" | "YANGQIAO";

const EXTRA: ExtraId[] = ["REN","DU","CHONG","DAI","YINWEI","YANGWEI","YINQIAO","YANGQIAO"];

const SVG_SRC = "/assets/12meridians8extra_CVGV.svg";
const BUILD = "MAPPER_EXTRA_SINGLEFILE_BUILD_001";

type Map
