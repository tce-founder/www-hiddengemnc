#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { buildApp } from '../lib/app';

// Secrets arrive as environment variables (GitHub environment secrets in CI)
// and are never written to cdk.json.
const app = new cdk.App();
buildApp(app, {
  basicAuthUsername: process.env.BASIC_AUTH_USERNAME,
  basicAuthPassword: process.env.BASIC_AUTH_PASSWORD,
  recaptchaSecretKey: process.env.RECAPTCHA_SECRET_KEY,
});
app.synth();
