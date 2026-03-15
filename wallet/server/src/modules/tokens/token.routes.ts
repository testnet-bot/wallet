import { Router } from 'express'
import * as TokenController from './token.controller'

export const router = Router()

router.get('/list', TokenController.listTokens)
