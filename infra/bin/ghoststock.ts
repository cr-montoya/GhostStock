#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import { buildGhostStockApp } from "../lib/app.js";

const app = new App();
buildGhostStockApp(app);
app.synth();
