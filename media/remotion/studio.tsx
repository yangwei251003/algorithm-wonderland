import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {SmokeComposition} from './SmokeComposition';
const Root = () => <Composition id="RemotionGate" component={SmokeComposition} width={1280} height={720} fps={30} durationInFrames={360} defaultProps={{origin:0,goal:24,walls:[7,12,17]}}/>;
registerRoot(Root);
