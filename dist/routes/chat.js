import { Router } from "express";
import { getMessages, sendMessage } from "../controllers/chatController.js";
const router = Router();
router.get('/:roomId', getMessages);
router.post('/:roomId', sendMessage);
export default router;
//# sourceMappingURL=chat.js.map