/**
 * ゲーム全体で利用する定数を定義
 */

export const TIME_SPAN = 1000;          // ゲーム時間を進める単位(ms)
export const FRAME_SPAN = 1000 / 60;    // 1フレーム進めるまでの時間

export const KILO_PER_KNOT = 1.852      // 1ktは何km/hか

export const GRAV_ACCE = 9.80665;       // 重力加速度(m/s^2)

// ** enum **
export const GameDifficulty = {
    easy: 0,
    normal: 1,
    hard: 2,
}


export const EngineOut = {
    aheadFull: 3,
    aheadHalf: 2,
    aheadSlow: 1,
    stop: 0,
    asternSlow: -1,
    asternHalf: -2,
    asternFull: -3,
};

export const ObjectType = {
    torpedo: 0,
    shell: 1,
    depthCharge: 2,
    uBoatType7C: 3,
    marchant1: 4,
    destoryer1: 5,
};

export const EnemyShipStatus = {
    usually: 0,
    caution: 1,
    alarm: 2,
}

export const SurfaceStatus = {
    surface: 0,
    periscope: 1,
    submerged: 2,
}
