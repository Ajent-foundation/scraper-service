import { Router } from 'express';
import actions from '../handlers/recording/actions';
import network from '../handlers/recording/network';
import cdp from '../handlers/recording/cdp';
import raw from '../handlers/recording/raw';

const RECORDING_ROUTES = Router();

// Recording endpoints - proxied to browser-node
RECORDING_ROUTES.get('/:sessionID/actions', actions);
RECORDING_ROUTES.get('/:sessionID/network', network);
RECORDING_ROUTES.get('/:sessionID/cdp', cdp);
RECORDING_ROUTES.get('/:sessionID/raw/:type', raw);

export default RECORDING_ROUTES;

